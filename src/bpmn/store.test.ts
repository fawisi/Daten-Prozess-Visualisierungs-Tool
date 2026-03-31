import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProcessStore } from './store.js';
import { emptyProcess } from './schema.js';
import type { Process } from './schema.js';
import { readFile, unlink, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let dir: string;
let filePath: string;
let store: ProcessStore;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bpmn-store-test-'));
  filePath = join(dir, 'test.bpmn.json');
  store = new ProcessStore(filePath);
});

afterEach(async () => {
  try {
    await unlink(filePath);
  } catch {}
});

describe('ProcessStore', () => {
  it('returns empty process for missing file', async () => {
    const process = await store.load();
    expect(process).toEqual(emptyProcess());
  });

  it('save and load roundtrip', async () => {
    const process: Process = {
      format: 'daten-viz-bpmn-v1',
      name: 'Test',
      nodes: {
        start: { type: 'start-event', label: 'Begin' },
        task1: { type: 'task', label: 'Work' },
      },
      flows: [{ from: 'start', to: 'task1', label: null }],
    };
    await store.save(process);
    const loaded = await store.load();
    expect(loaded).toEqual(process);
  });

  it('writes valid JSON to disk', async () => {
    await store.save(emptyProcess());
    const raw = await readFile(filePath, 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('throws on corrupt JSON', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(filePath, 'not json', 'utf-8');
    await expect(store.load()).rejects.toThrow('Invalid JSON');
  });

  it('throws on invalid schema', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(filePath, JSON.stringify({ format: 'wrong' }), 'utf-8');
    await expect(store.load()).rejects.toThrow('Invalid schema');
  });
});
