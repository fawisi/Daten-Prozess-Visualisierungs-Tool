import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerBundleTools } from './tools.js';
import { buildBundleBlob } from './serialize.js';
import type { BundleManifest } from './manifest.js';
import { ProcessStore } from '../bpmn/store.js';
import { LandscapeStore } from '../landscape/store.js';
import { DbmlStore } from '../dbml-store.js';

/**
 * The MCP registry is not trivially observable from the outside, so we
 * exercise export_bundle + import_bundle through the buildBundleBlob /
 * parseBundleBlob primitives (already tested) + the filesystem side
 * of the tools module indirectly: we verify the round-trip property
 * that matters (export → import → schema identity) works for bpmn +
 * landscape by simulating the tool call.
 */

async function setupFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'viso-bundle-'));
  const bpmnPath = join(dir, 'process.bpmn.json');
  const landscapePath = join(dir, 'landscape.landscape.json');
  const erdPath = join(dir, 'schema.dbml');

  await writeFile(
    bpmnPath,
    JSON.stringify(
      {
        format: 'viso-bpmn-v1',
        name: 'Order',
        nodes: {
          start: { type: 'start-event', label: 'Start' },
          t1: { type: 'task', label: 'Review' },
          end: { type: 'end-event', label: 'Done' },
        },
        flows: [
          { from: 'start', to: 't1', label: null },
          { from: 't1', to: 'end', label: null },
        ],
      },
      null,
      2
    )
  );
  await writeFile(
    landscapePath,
    JSON.stringify(
      {
        format: 'viso-landscape-v1',
        name: 'Demo',
        nodes: {
          User: { kind: 'person', label: 'Kunde' },
          Web: { kind: 'system', label: 'Webshop' },
        },
        relations: [{ from: 'User', to: 'Web', label: 'browse' }],
      },
      null,
      2
    )
  );
  await writeFile(
    erdPath,
    `Table users {\n  id uuid [pk]\n  email varchar [not null]\n}\n`
  );

  const stores = {
    bpmnStore: new ProcessStore(bpmnPath),
    landscapeStore: new LandscapeStore(landscapePath),
    erdStore: new DbmlStore(erdPath),
  };
  return { dir, bpmnPath, landscapePath, erdPath, stores };
}

describe('bundle tools — round-trip', () => {
  let fixture: Awaited<ReturnType<typeof setupFixture>>;

  beforeEach(async () => {
    fixture = await setupFixture();
  });

  afterEach(async () => {
    await rm(fixture.dir, { recursive: true, force: true });
  });

  it('registers export_bundle + import_bundle without throwing', () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    expect(() => registerBundleTools(server, fixture.stores)).not.toThrow();
  });

  it('BPMN: build → parse round-trips the source bit-identically', async () => {
    const source = await readFile(fixture.bpmnPath, 'utf-8');
    const manifest: BundleManifest = {
      version: '1.1',
      diagramType: 'bpmn',
      name: 'round-trip',
      tool: { name: 'viso-mcp', version: 'test' },
    };
    const blob = await buildBundleBlob({ manifest, source });
    const { parseBundleBlob } = await import('./serialize.js');
    const parsed = await parseBundleBlob(new Uint8Array(await blob.arrayBuffer()));
    expect(parsed.source).toBe(source);
    // Parsing the source through ProcessSchema matches the original store load.
    const originalProcess = await fixture.stores.bpmnStore.load();
    const roundTripped = JSON.parse(parsed.source);
    expect(roundTripped).toEqual(originalProcess);
  });

  it('Landscape: build → parse round-trips the source bit-identically', async () => {
    const source = await readFile(fixture.landscapePath, 'utf-8');
    const manifest: BundleManifest = {
      version: '1.1',
      diagramType: 'landscape',
      name: 'round-trip',
      tool: { name: 'viso-mcp', version: 'test' },
    };
    const blob = await buildBundleBlob({ manifest, source });
    const { parseBundleBlob } = await import('./serialize.js');
    const parsed = await parseBundleBlob(new Uint8Array(await blob.arrayBuffer()));
    expect(parsed.source).toBe(source);
    const originalLandscape = await fixture.stores.landscapeStore.load();
    expect(JSON.parse(parsed.source)).toEqual(originalLandscape);
  });

  it('ERD: build → parse preserves the raw DBML (round-trip avoids lossy JSON re-emit)', async () => {
    const source = await readFile(fixture.erdPath, 'utf-8');
    const manifest: BundleManifest = {
      version: '1.1',
      diagramType: 'erd',
      name: 'round-trip',
      tool: { name: 'viso-mcp', version: 'test' },
    };
    const blob = await buildBundleBlob({ manifest, source });
    const { parseBundleBlob } = await import('./serialize.js');
    const parsed = await parseBundleBlob(new Uint8Array(await blob.arrayBuffer()));
    expect(parsed.source).toBe(source);
  });
});
