import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { LandscapeStore } from './store.js';
import {
  LandscapeNodeIdentifier,
  LandscapeSchema,
  LandscapeStatus,
  isL1Kind,
} from './schema.js';
import { landscapeToMermaid } from './export-mermaid.js';
import { loadModeSidecar, saveModeSidecar } from '../mode-sidecar.js';
import { parseLandscapeDescription } from './parse-description.js';
import { ParseDescriptionConfigSchema } from '../narrative/config.js';

const LandscapeKind = z.enum([
  'person',
  'system',
  'external',
  'container',
  'database',
  'cloud',
  'boundary',
]);

function landscapeSummary(landscape: { nodes: Record<string, unknown>; relations: unknown[] }): string {
  const n = Object.keys(landscape.nodes).length;
  const r = landscape.relations.length;
  return `Landscape now has ${n} node${n !== 1 ? 's' : ''}, ${r} relation${r !== 1 ? 's' : ''}.`;
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

export function registerLandscapeTools(server: McpServer, store: LandscapeStore) {
  // --- landscape_add_node ---
  server.registerTool(
    'landscape_add_node',
    {
      description:
        'Add a node to the system landscape. Kind chooses the discriminated-union branch: person/system/external are L1 kinds; container/database/cloud/boundary are L2-only. For > 3 mutations prefer `set_landscape`.',
      inputSchema: z.object({
        id: LandscapeNodeIdentifier.describe('Unique node ID'),
        kind: LandscapeKind.describe('Node kind (person/system/external = L1; container/database/cloud/boundary = L2)'),
        label: z.string().max(256).describe('Display label'),
        description: z.string().max(512).optional(),
        technology: z
          .string()
          .max(128)
          .optional()
          .describe('Runtime / platform (L2-only; ignored on L1 kinds)'),
        parentId: LandscapeNodeIdentifier.optional().describe(
          'Parent boundary id for L2 containment (only valid when target boundary exists)'
        ),
      }),
    },
    async ({ id, kind, label, description, technology, parentId }) => {
      const landscape = await store.load();
      if (landscape.nodes[id]) {
        return textResult(`Node "${id}" already exists. Remove it first if you want to recreate.`);
      }
      if (parentId && !landscape.nodes[parentId]) {
        return textResult(`parentId "${parentId}" not found; add the boundary first.`);
      }
      if (parentId && landscape.nodes[parentId]?.kind !== 'boundary') {
        return textResult(`parentId "${parentId}" is not a boundary kind; only boundaries can contain children.`);
      }
      const baseNode = {
        kind,
        label,
        ...(description ? { description } : {}),
      };
      if (isL1Kind(kind)) {
        landscape.nodes[id] = baseNode as (typeof landscape.nodes)[string];
      } else {
        landscape.nodes[id] = {
          ...baseNode,
          ...(technology ? { technology } : {}),
          ...(parentId ? { parentId } : {}),
        } as (typeof landscape.nodes)[string];
      }
      await store.save(landscape);
      return textResult(`Added ${kind} "${id}" with label "${label}". ${landscapeSummary(landscape)}`);
    }
  );

  // --- landscape_remove_node ---
  server.registerTool(
    'landscape_remove_node',
    {
      description:
        'Remove a node and all its relations. If the node is a boundary, children lose their parentId (nondestructive — they remain in the schema as top-level nodes).',
      inputSchema: z.object({
        id: LandscapeNodeIdentifier.describe('ID of the node to remove'),
      }),
    },
    async ({ id }) => {
      const landscape = await store.load();
      if (!landscape.nodes[id]) {
        return textResult(`Node "${id}" not found.`);
      }
      delete landscape.nodes[id];
      const beforeRel = landscape.relations.length;
      landscape.relations = landscape.relations.filter(
        (r) => r.from !== id && r.to !== id
      );
      // Un-parent former children so they stay visible.
      for (const [nid, node] of Object.entries(landscape.nodes)) {
        if ('parentId' in node && node.parentId === id) {
          delete (node as { parentId?: string }).parentId;
          landscape.nodes[nid] = node;
        }
      }
      await store.save(landscape);
      const cascaded = beforeRel - landscape.relations.length;
      return textResult(
        `Removed node "${id}"${cascaded > 0 ? ` and ${cascaded} connected relation${cascaded !== 1 ? 's' : ''}` : ''}. ${landscapeSummary(landscape)}`
      );
    }
  );

  // --- landscape_add_relation ---
  server.registerTool(
    'landscape_add_relation',
    {
      description:
        'Add a relation between two landscape nodes. C4 convention: every relation should have a label describing intent/protocol — pass it via `label`. `technology` is L2-only metadata (e.g. "REST/HTTPS").',
      inputSchema: z.object({
        from: LandscapeNodeIdentifier,
        to: LandscapeNodeIdentifier,
        label: z.string().max(256).optional(),
        technology: z.string().max(128).optional(),
      }),
    },
    async ({ from, to, label, technology }) => {
      const landscape = await store.load();
      if (!landscape.nodes[from]) return textResult(`Source node "${from}" not found.`);
      if (!landscape.nodes[to]) return textResult(`Target node "${to}" not found.`);
      const exists = landscape.relations.some((r) => r.from === from && r.to === to);
      if (exists) return textResult(`Relation from "${from}" to "${to}" already exists.`);
      landscape.relations.push({
        from,
        to,
        ...(label ? { label } : {}),
        ...(technology ? { technology } : {}),
      });
      await store.save(landscape);
      return textResult(
        `Added relation ${from} → ${to}${label ? ` ("${label}")` : ''}. ${landscapeSummary(landscape)}`
      );
    }
  );

  // --- landscape_remove_relation ---
  server.registerTool(
    'landscape_remove_relation',
    {
      description: 'Remove a relation by its (from, to) pair.',
      inputSchema: z.object({
        from: LandscapeNodeIdentifier,
        to: LandscapeNodeIdentifier,
      }),
    },
    async ({ from, to }) => {
      const landscape = await store.load();
      const before = landscape.relations.length;
      landscape.relations = landscape.relations.filter(
        (r) => !(r.from === from && r.to === to)
      );
      const removed = before - landscape.relations.length;
      if (removed === 0) return textResult(`No relation found from "${from}" to "${to}".`);
      await store.save(landscape);
      return textResult(`Removed relation ${from} → ${to}. ${landscapeSummary(landscape)}`);
    }
  );

  // --- landscape_set_node_status ---
  server.registerTool(
    'landscape_set_node_status',
    {
      description: 'Set the audit status on a landscape node. Pass status=null to clear.',
      inputSchema: z.object({
        id: LandscapeNodeIdentifier,
        status: LandscapeStatus.nullable(),
      }),
      annotations: { idempotentHint: true },
    },
    async ({ id, status }) => {
      const landscape = await store.load();
      const node = landscape.nodes[id];
      if (!node) return textResult(`Node "${id}" not found.`);
      if (status === null) {
        delete (node as { status?: unknown }).status;
      } else {
        (node as { status?: string }).status = status;
      }
      await store.save(landscape);
      return textResult(status === null ? `Cleared status on "${id}".` : `Set status of "${id}" to "${status}".`);
    }
  );

  // --- landscape_set_relation_status ---
  server.registerTool(
    'landscape_set_relation_status',
    {
      description: 'Set the audit status on a landscape relation (identified by from+to). Pass status=null to clear.',
      inputSchema: z.object({
        from: LandscapeNodeIdentifier,
        to: LandscapeNodeIdentifier,
        status: LandscapeStatus.nullable(),
      }),
      annotations: { idempotentHint: true },
    },
    async ({ from, to, status }) => {
      const landscape = await store.load();
      const rel = landscape.relations.find((r) => r.from === from && r.to === to);
      if (!rel) return textResult(`Relation ${from} → ${to} not found.`);
      if (status === null) delete (rel as { status?: unknown }).status;
      else (rel as { status?: string }).status = status;
      await store.save(landscape);
      return textResult(
        status === null
          ? `Cleared status on relation ${from} → ${to}.`
          : `Set status of relation ${from} → ${to} to "${status}".`
      );
    }
  );

  // --- landscape_update_node ---
  server.registerTool(
    'landscape_update_node',
    {
      description:
        'Update mutable fields on a landscape node (label, description, technology). Omitted fields unchanged; description=""/technology="" clears.',
      inputSchema: z.object({
        id: LandscapeNodeIdentifier,
        label: z.string().max(256).optional(),
        description: z.string().max(512).optional(),
        technology: z.string().max(128).optional(),
      }),
      annotations: { idempotentHint: true },
    },
    async ({ id, label, description, technology }) => {
      const landscape = await store.load();
      const node = landscape.nodes[id] as Record<string, unknown> | undefined;
      if (!node) return textResult(`Node "${id}" not found.`);
      if (label !== undefined) node.label = label;
      if (description !== undefined) {
        if (description === '') delete node.description;
        else node.description = description;
      }
      if (technology !== undefined) {
        if (isL1Kind(node.kind as string)) {
          return textResult(`Node "${id}" is an L1 kind — 'technology' only applies to L2 kinds.`);
        }
        if (technology === '') delete node.technology;
        else node.technology = technology;
      }
      await store.save(landscape);
      return textResult(`Updated node "${id}".`);
    }
  );

  // --- landscape_set_parent ---
  server.registerTool(
    'landscape_set_parent',
    {
      description:
        'Move a node into or out of a boundary (L2 containment). Pass parentId=null to un-parent. Target boundary must exist and be of kind=boundary.',
      inputSchema: z.object({
        id: LandscapeNodeIdentifier,
        parentId: LandscapeNodeIdentifier.nullable(),
      }),
      annotations: { idempotentHint: true },
    },
    async ({ id, parentId }) => {
      const landscape = await store.load();
      const node = landscape.nodes[id] as Record<string, unknown> | undefined;
      if (!node) return textResult(`Node "${id}" not found.`);
      if (node.kind === 'boundary') return textResult(`Cannot set parent on a boundary (boundaries don't nest in v1.1).`);
      if (isL1Kind(node.kind as string)) {
        return textResult(`Node "${id}" is an L1 kind — containment is L2-only.`);
      }
      if (parentId !== null) {
        const parent = landscape.nodes[parentId];
        if (!parent) return textResult(`Parent "${parentId}" not found.`);
        if (parent.kind !== 'boundary') return textResult(`Parent "${parentId}" is not a boundary.`);
        node.parentId = parentId;
      } else {
        delete node.parentId;
      }
      await store.save(landscape);
      return textResult(
        parentId === null
          ? `Un-parented "${id}".`
          : `Moved "${id}" into boundary "${parentId}".`
      );
    }
  );

  // --- landscape_set_mode ---
  server.registerTool(
    'landscape_set_mode',
    {
      description:
        "Set the landscape mode sidecar (l1 | l2). L1 hides L2-only kinds (container/database/cloud/boundary) in the canvas UI but keeps them in the schema (nondestructive downgrade). Mode is persisted in <file>.landscape.mode.json.",
      inputSchema: z.object({
        mode: z.enum(['l1', 'l2']),
      }),
      annotations: { idempotentHint: true },
    },
    async ({ mode }) => {
      await saveModeSidecar(store.filePath, {
        kind: 'landscape',
        mode,
        version: '1.1',
      });
      return textResult(JSON.stringify({ ok: true, mode }, null, 2));
    }
  );

  // --- landscape_get_mode ---
  server.registerTool(
    'landscape_get_mode',
    {
      description: "Read the landscape mode sidecar. Defaults to 'l1' when no sidecar exists.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const sidecar = await loadModeSidecar(store.filePath);
      if (sidecar?.kind === 'landscape') {
        return textResult(JSON.stringify({ mode: sidecar.mode, source: 'sidecar' }, null, 2));
      }
      return textResult(JSON.stringify({ mode: 'l1', source: 'default' }, null, 2));
    }
  );

  // --- landscape_get_schema ---
  server.registerTool(
    'landscape_get_schema',
    {
      description:
        'Read the current landscape. Returns { landscape, metadata } where `landscape` is the LandscapeSchema payload and `metadata.mode` ("l1" | "l2") comes from the sidecar or defaults to "l1".',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const landscape = await store.load();
      const sidecar = await loadModeSidecar(store.filePath);
      const mode = sidecar?.kind === 'landscape' ? sidecar.mode : 'l1';
      return textResult(JSON.stringify({ landscape, metadata: { mode } }, null, 2));
    }
  );

  // --- landscape_export_mermaid ---
  server.registerTool(
    'landscape_export_mermaid',
    {
      description:
        'Export the landscape as Mermaid. Default variant is `flowchart` (C4-labelled) — use for GitHub/Notion/Claude.md. Set variant=architecture-beta for an icon-rich preview (note: edge labels are lost).',
      inputSchema: z.object({
        variant: z.enum(['flowchart', 'architecture-beta']).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ variant }) => {
      const landscape = await store.load();
      if (Object.keys(landscape.nodes).length === 0) {
        return textResult('Landscape is empty. Add nodes first.');
      }
      return textResult(landscapeToMermaid(landscape, { variant }));
    }
  );

  // --- landscape_parse_description ---
  server.registerTool(
    'landscape_parse_description',
    {
      description:
        "Parse German narrative text into landscape nodes + relations (regex-first, plan R5). Example input: 'Winestro synchronisiert taeglich mit Shopify, SharePoint speichert Rechnungen'. Merges into the current landscape — re-calling with the same text is idempotent. `config.engine='llm'` is reserved for MCP sampling and currently degrades to regex with a warning. Returns unparsedSpans so the agent knows which sentences to re-phrase.",
      inputSchema: z.object({
        text: z.string().min(1).max(20000).describe('Narrative text in German'),
        config: ParseDescriptionConfigSchema.optional(),
        persist: z.boolean().default(true).describe(
          'When true (default), the parsed result is written to the landscape file. When false, the result is returned without touching disk.'
        ),
      }),
      annotations: { idempotentHint: true },
    },
    async ({ text, config, persist }) => {
      const base = await store.load();
      const result = parseLandscapeDescription(text, config, base);
      // MA-7: persisted=false when the parser added nothing new.
      const noOp =
        result.stats.nodesAdded === 0 && result.stats.relationsAdded === 0;
      const persisted = persist && !noOp;
      if (persisted) {
        await store.save(result.landscape);
      }
      return textResult(
        JSON.stringify(
          {
            ok: true,
            engineUsed: result.engineUsed,
            stats: result.stats,
            warnings: result.warnings,
            unparsedSpans: result.unparsedSpans,
            persisted,
            noOp,
            nodeCount: Object.keys(result.landscape.nodes).length,
            relationCount: result.landscape.relations.length,
          },
          null,
          2
        )
      );
    }
  );

  // --- set_landscape ---
  server.registerTool(
    'set_landscape',
    {
      description:
        'Replace the entire landscape with new JSON in one call. Atomic — the file stays unchanged on parse error. For > 3 mutations prefer this over atomic add/remove tools. The canonical parameter is `landscape`; the legacy `json` alias is accepted for backwards compatibility (MA-4).',
      inputSchema: z
        .object({
          landscape: z
            .string()
            .min(1, 'Landscape JSON cannot be empty')
            .optional(),
          json: z
            .string()
            .min(1)
            .describe('@deprecated — use `landscape` instead (kept for v1.0 compat)')
            .optional(),
        })
        .refine((d) => d.landscape !== undefined || d.json !== undefined, {
          message: 'Either `landscape` or `json` must be provided',
        }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (input) => {
      const json = input.landscape ?? input.json!;
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch (err) {
        return problemResult({
          type: 'https://viso-mcp.dev/problems/landscape-parse-error',
          title: 'Landscape JSON parse error',
          detail: (err as Error).message,
        });
      }
      const validated = LandscapeSchema.safeParse(parsed);
      if (!validated.success) {
        return problemResult({
          type: 'https://viso-mcp.dev/problems/landscape-schema-invalid',
          title: 'Landscape JSON failed schema validation',
          errors: validated.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        });
      }
      await store.save(validated.data);
      return textResult(
        JSON.stringify(
          {
            ok: true,
            nodeCount: Object.keys(validated.data.nodes).length,
            relationCount: validated.data.relations.length,
          },
          null,
          2
        )
      );
    }
  );
}
