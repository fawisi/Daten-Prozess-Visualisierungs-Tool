import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { derivePositionsPath, prunePositions } from './positions.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'viso-positions-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('derivePositionsPath', () => {
  it('maps .dbml to .erd.pos.json so legacy sidecars keep working', () => {
    expect(derivePositionsPath('/x/schema.dbml')).toBe('/x/schema.erd.pos.json');
  });

  it('maps .erd.json to .erd.pos.json', () => {
    expect(derivePositionsPath('/x/schema.erd.json')).toBe(
      '/x/schema.erd.pos.json'
    );
  });

  it('maps .bpmn.json to .bpmn.pos.json', () => {
    expect(derivePositionsPath('/x/process.bpmn.json')).toBe(
      '/x/process.bpmn.pos.json'
    );
  });

  it('falls back to appending .pos.json for unknown suffixes', () => {
    expect(derivePositionsPath('/x/custom.txt')).toBe('/x/custom.txt.pos.json');
  });
});

describe('prunePositions', () => {
  it('returns empty list when the sidecar file does not exist', async () => {
    const result = await prunePositions(
      join(tempDir, 'missing.erd.pos.json'),
      new Set(['users'])
    );
    expect(result).toEqual([]);
  });

  it('removes IDs that are not in the valid set', async () => {
    const sidecar = join(tempDir, 's.erd.pos.json');
    await writeFile(
      sidecar,
      JSON.stringify({
        users: { x: 10, y: 20 },
        legacy_orphan: { x: 50, y: 60 },
        orders: { x: 100, y: 200 },
      })
    );

    const removed = await prunePositions(sidecar, new Set(['users', 'orders']));
    expect(removed).toEqual(['legacy_orphan']);

    const kept = JSON.parse(await readFile(sidecar, 'utf-8')) as Record<
      string,
      unknown
    >;
    expect(Object.keys(kept).sort()).toEqual(['orders', 'users']);
    expect(kept.legacy_orphan).toBeUndefined();
  });

  it('does not rewrite the file when nothing would be pruned', async () => {
    const sidecar = join(tempDir, 's.erd.pos.json');
    const original = JSON.stringify({ a: { x: 1, y: 2 }, b: { x: 3, y: 4 } });
    await writeFile(sidecar, original);
    const beforeStat = (await import('node:fs/promises')).stat;
    const before = await beforeStat(sidecar);

    const removed = await prunePositions(sidecar, new Set(['a', 'b']));
    expect(removed).toEqual([]);

    const after = await beforeStat(sidecar);
    expect(after.mtimeMs).toBe(before.mtimeMs);
  });

  it('leaves a malformed sidecar alone', async () => {
    const sidecar = join(tempDir, 's.erd.pos.json');
    const garbage = 'not-json-but-still-there';
    await writeFile(sidecar, garbage);

    const removed = await prunePositions(sidecar, new Set(['users']));
    expect(removed).toEqual([]);

    const after = await readFile(sidecar, 'utf-8');
    expect(after).toBe(garbage);
  });
});
