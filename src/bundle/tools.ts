import { z } from 'zod';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { buildBundleBlob, parseBundleBlob } from './serialize.js';
import { BundleManifestSchema, BUNDLE_SCHEMA_VERSION } from './manifest.js';
import type { BundleManifest } from './manifest.js';
import { ProcessStore } from '../bpmn/store.js';
import { LandscapeStore } from '../landscape/store.js';
import { DbmlStore } from '../dbml-store.js';
import { DiagramStore } from '../store.js';
import { ProcessSchema } from '../bpmn/schema.js';
import { LandscapeSchema } from '../landscape/schema.js';
import { DiagramSchema } from '../schema.js';
import { processToMermaid } from '../bpmn/export-mermaid.js';
import { landscapeToMermaid } from '../landscape/export-mermaid.js';
import { toMermaid as erdToMermaid } from '../export/mermaid.js';
import { loadModeSidecar } from '../mode-sidecar.js';
import { assertSidecarInsideRoot } from '../positions.js';
import type { ErdStore } from '../erd-store-interface.js';

/**
 * Bundle MCP tools: export_bundle + import_bundle. Shared across all
 * three diagram kinds (erd / bpmn / landscape). Lives in its own module
 * so the plan R8 "pure / browser / node" split stays clean:
 * `bundle/manifest.ts` + `bundle/serialize.ts` are pure (no FS), this
 * file is node-only (fs), the browser calls `buildBundleBlob` directly.
 */

interface BundleStores {
  erdStore: ErdStore;
  bpmnStore: ProcessStore;
  landscapeStore: LandscapeStore;
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function problemResult(body: Record<string, unknown>) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: JSON.stringify(body, null, 2) }],
  };
}

async function readSource(
  diagramType: 'erd' | 'bpmn' | 'landscape',
  stores: BundleStores
): Promise<string> {
  if (diagramType === 'bpmn') {
    return readFile(stores.bpmnStore.filePath, 'utf-8').catch(() => '{}');
  }
  if (diagramType === 'landscape') {
    return readFile(stores.landscapeStore.filePath, 'utf-8').catch(() => '{}');
  }
  return readFile(stores.erdStore.filePath, 'utf-8').catch(() => '');
}

async function renderMermaidFor(
  diagramType: 'erd' | 'bpmn' | 'landscape',
  stores: BundleStores
): Promise<string | undefined> {
  try {
    if (diagramType === 'bpmn') {
      const p = await stores.bpmnStore.load();
      if (Object.keys(p.nodes).length === 0) return undefined;
      return processToMermaid(p);
    }
    if (diagramType === 'landscape') {
      const l = await stores.landscapeStore.load();
      if (Object.keys(l.nodes).length === 0) return undefined;
      return landscapeToMermaid(l);
    }
    const d = await stores.erdStore.load();
    if (Object.keys(d.tables).length === 0) return undefined;
    return erdToMermaid(d);
  } catch {
    return undefined;
  }
}

async function readModeForManifest(
  diagramType: 'erd' | 'bpmn' | 'landscape',
  stores: BundleStores
): Promise<BundleManifest['mode']> {
  if (diagramType === 'erd') return undefined;
  const path =
    diagramType === 'bpmn' ? stores.bpmnStore.filePath : stores.landscapeStore.filePath;
  const sidecar = await loadModeSidecar(path).catch(() => null);
  if (sidecar?.kind === 'bpmn') return sidecar.mode;
  if (sidecar?.kind === 'landscape') return sidecar.mode;
  return undefined;
}

function diagramNameFor(
  diagramType: 'erd' | 'bpmn' | 'landscape',
  stores: BundleStores
): string {
  const path =
    diagramType === 'bpmn'
      ? stores.bpmnStore.filePath
      : diagramType === 'landscape'
        ? stores.landscapeStore.filePath
        : stores.erdStore.filePath;
  const name = basename(path);
  return name.replace(/\.(erd\.dbml|dbml|bpmn\.json|landscape\.json)$/, '');
}

function selectErdStore(path: string): ErdStore {
  if (path.endsWith('.erd.json')) return new DiagramStore(path);
  return new DbmlStore(path);
}

/**
 * XOR-validates the {inPath, inBytes} pair on `import_bundle`. Exactly
 * one of the two is required; the agent or hub picks the channel that
 * fits its workflow (CLI uses `inPath`, an in-process Hub adapter uses
 * `inBytes`). Extracted for unit-test coverage (MA-6 — v1.1.2).
 */
export function validateImportSource(
  inPath: string | undefined,
  inBytes: string | undefined
):
  | { ok: true; mode: 'path' | 'bytes' }
  | { ok: false; error: string } {
  if (!inPath && !inBytes) {
    return { ok: false, error: 'Provide one of inPath or inBytes' };
  }
  if (inPath && inBytes) {
    return {
      ok: false,
      error: 'Provide only one of inPath or inBytes, not both',
    };
  }
  return { ok: true, mode: inPath ? 'path' : 'bytes' };
}

/**
 * Register `export_bundle` + `import_bundle` tools.
 *
 * `export_bundle` is always server-side (CLI / agent) — writes a Zip to
 * `outPath`. Browser-side export runs `buildBundleBlob` directly and
 * offers the blob as a download; the tool exists for agent workflows.
 *
 * `import_bundle` reads a Zip from disk, validates (schema + whitelist
 * + size caps), and routes the source into the matching store.
 */
export function registerBundleTools(server: McpServer, stores: BundleStores) {
  const TOOL_VERSION = '1.1.0-alpha';

  server.registerTool(
    'export_bundle',
    {
      description:
        "Export a Handoff-Bundle Zip (.viso.json manifest + source + positions + Mermaid) for a diagram. With `outPath` writes the Zip to disk; without `outPath` returns the Zip bytes base64-encoded so an in-process caller (Hub, sandboxed agent) can ship the bundle without touching the filesystem (MA-6).",
      inputSchema: z.object({
        diagramType: z.enum(['erd', 'bpmn', 'landscape']),
        outPath: z
          .string()
          .optional()
          .describe(
            'Absolute file path to write the Zip to. Omit for an in-memory base64 return.'
          ),
        includeExports: z
          .array(z.enum(['mermaid', 'svg', 'png']))
          .optional()
          .describe("Which exports to embed. Default: ['mermaid'] (SVG/PNG need a browser renderer)"),
      }),
      annotations: { idempotentHint: true },
    },
    async ({ diagramType, outPath, includeExports }) => {
      const wanted = new Set(includeExports ?? ['mermaid']);
      const source = await readSource(diagramType, stores);
      const mode = await readModeForManifest(diagramType, stores);
      const manifest: BundleManifest = {
        version: BUNDLE_SCHEMA_VERSION,
        diagramType,
        name: diagramNameFor(diagramType, stores),
        ...(mode ? { mode } : {}),
        createdAt: new Date().toISOString(),
        tool: { name: 'viso-mcp', version: TOOL_VERSION },
      };
      const mermaid = wanted.has('mermaid') ? await renderMermaidFor(diagramType, stores) : undefined;
      const blob = await buildBundleBlob({ manifest, source, mermaid });
      const buf = Buffer.from(await blob.arrayBuffer());

      // MA-6: in-memory path. No `outPath` means the caller wants the
      // bytes returned directly (base64) so they can keep the bundle in
      // memory, ship it over a non-FS channel, or write it themselves.
      if (!outPath) {
        return textResult(
          JSON.stringify(
            {
              ok: true,
              bytes: buf.toString('base64'),
              byteLength: buf.byteLength,
              manifest,
            },
            null,
            2
          )
        );
      }

      const resolved = resolve(outPath);
      // Defence in depth: keep the write anchored to its own directory
      // (guards against `export_bundle` being pointed at a path that
      // climbs out of an agent-provided root if one ever plumbs a root in).
      assertSidecarInsideRoot(resolved, dirname(resolved));
      await writeFile(resolved, buf);
      return textResult(
        JSON.stringify(
          {
            ok: true,
            path: resolved,
            bytes: buf.byteLength,
            manifest,
          },
          null,
          2
        )
      );
    }
  );

  server.registerTool(
    'import_bundle',
    {
      description:
        "Import a Handoff-Bundle Zip. Provide either `inPath` (read from disk) or `inBytes` (base64-encoded Zip; MA-6 — for in-process Hub callers). Validates the manifest, enforces the entry whitelist + size caps, then routes the source into the matching store. `onConflict` controls what happens when the current file is non-empty ('rename' = write to <name>-v2, 'overwrite' = replace, 'abort' = reject).",
      inputSchema: z.object({
        inPath: z
          .string()
          .optional()
          .describe(
            'Absolute path to the .zip file. Mutually exclusive with `inBytes`.'
          ),
        inBytes: z
          .string()
          .optional()
          .describe(
            'Base64-encoded bundle bytes. Mutually exclusive with `inPath`.'
          ),
        onConflict: z.enum(['rename', 'overwrite', 'abort']).default('rename'),
      }),
      annotations: { destructiveHint: true },
    },
    async ({ inPath, inBytes, onConflict }) => {
      const sourceCheck = validateImportSource(inPath, inBytes);
      if (!sourceCheck.ok) {
        return problemResult({
          type: 'https://viso-mcp.dev/problems/bundle-import-invalid-input',
          title: 'Bundle import input invalid',
          detail: sourceCheck.error,
        });
      }
      const buf =
        sourceCheck.mode === 'path'
          ? await readFile(resolve(inPath!))
          : Buffer.from(inBytes!, 'base64');
      const parsed = await parseBundleBlob(new Uint8Array(buf)).catch((err) => err as Error);
      if (parsed instanceof Error) {
        return problemResult({
          type: 'https://viso-mcp.dev/problems/bundle-import-invalid',
          title: 'Bundle import rejected',
          detail: parsed.message,
        });
      }

      const { manifest, source } = parsed;
      // Schema-validate the source BEFORE touching the store.
      if (manifest.diagramType === 'bpmn') {
        const check = ProcessSchema.safeParse(JSON.parse(source));
        if (!check.success) {
          return problemResult({
            type: 'https://viso-mcp.dev/problems/bundle-source-invalid',
            title: 'Bundle source failed BPMN schema validation',
            errors: check.error.issues,
          });
        }
        // Conflict check — if current file has any nodes and onConflict
        // is 'abort', refuse.
        const current = await stores.bpmnStore.load();
        if (onConflict === 'abort' && Object.keys(current.nodes).length > 0) {
          return textResult(
            JSON.stringify({ ok: false, reason: 'onConflict=abort — current BPMN has nodes' })
          );
        }
        if (onConflict === 'rename') {
          const renamedPath = stores.bpmnStore.filePath.replace(
            /\.bpmn\.json$/,
            '-v2.bpmn.json'
          );
          const renamedStore = new ProcessStore(renamedPath);
          await renamedStore.save(check.data);
          return textResult(
            JSON.stringify({ ok: true, wroteTo: renamedPath, diagramType: 'bpmn' }, null, 2)
          );
        }
        await stores.bpmnStore.save(check.data);
        return textResult(
          JSON.stringify({ ok: true, wroteTo: stores.bpmnStore.filePath, diagramType: 'bpmn' }, null, 2)
        );
      }

      if (manifest.diagramType === 'landscape') {
        const check = LandscapeSchema.safeParse(JSON.parse(source));
        if (!check.success) {
          return problemResult({
            type: 'https://viso-mcp.dev/problems/bundle-source-invalid',
            title: 'Bundle source failed Landscape schema validation',
            errors: check.error.issues,
          });
        }
        const current = await stores.landscapeStore.load();
        if (onConflict === 'abort' && Object.keys(current.nodes).length > 0) {
          return textResult(
            JSON.stringify({ ok: false, reason: 'onConflict=abort — current landscape has nodes' })
          );
        }
        if (onConflict === 'rename') {
          const renamedPath = stores.landscapeStore.filePath.replace(
            /\.landscape\.json$/,
            '-v2.landscape.json'
          );
          const renamedStore = new LandscapeStore(renamedPath);
          await renamedStore.save(check.data);
          return textResult(
            JSON.stringify({ ok: true, wroteTo: renamedPath, diagramType: 'landscape' }, null, 2)
          );
        }
        await stores.landscapeStore.save(check.data);
        return textResult(
          JSON.stringify(
            { ok: true, wroteTo: stores.landscapeStore.filePath, diagramType: 'landscape' },
            null,
            2
          )
        );
      }

      // ERD: source is raw DBML. Route into a fresh DbmlStore (or the
      // active one for overwrite); conflict-rename writes the raw .dbml
      // since we don't want to round-trip through our lossy internal
      // schema (preserves indexes/enums/TableGroups).
      if (onConflict === 'abort') {
        const current = await stores.erdStore.load();
        if (Object.keys(current.tables).length > 0) {
          return textResult(
            JSON.stringify({ ok: false, reason: 'onConflict=abort — current ERD has tables' })
          );
        }
      }
      if (onConflict === 'rename') {
        const renamedPath = stores.erdStore.filePath.replace(/\.dbml$/, '-v2.dbml');
        await writeFile(renamedPath, source, 'utf-8');
        // Ensure the rename target still round-trips through DiagramSchema.
        const renamedStore = selectErdStore(renamedPath);
        const check = await renamedStore.load().catch((err) => err as Error);
        if (check instanceof Error) {
          return problemResult({
            type: 'https://viso-mcp.dev/problems/bundle-source-invalid',
            title: 'Bundle source failed ERD schema validation',
            detail: check.message,
          });
        }
        return textResult(
          JSON.stringify({ ok: true, wroteTo: renamedPath, diagramType: 'erd' }, null, 2)
        );
      }
      await writeFile(stores.erdStore.filePath, source, 'utf-8');
      const check = await stores.erdStore.load().catch((err) => err as Error);
      if (check instanceof Error) {
        return problemResult({
          type: 'https://viso-mcp.dev/problems/bundle-source-invalid',
          title: 'Bundle source failed ERD schema validation',
          detail: check.message,
        });
      }
      // Tell TS the validated ERD is good (consume the variable).
      DiagramSchema.parse(check);
      return textResult(
        JSON.stringify({ ok: true, wroteTo: stores.erdStore.filePath, diagramType: 'erd' }, null, 2)
      );
    }
  );
}
