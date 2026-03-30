import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DiagramStore } from './store.js';
import { emptyDiagram } from './schema.js';
import type { Diagram } from './schema.js';
import { writeFile } from 'node:fs/promises';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'daten-viz-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('DiagramStore', () => {
  it('returns empty diagram when file does not exist', async () => {
    const store = new DiagramStore(join(tempDir, 'missing.erd.json'));
    const diagram = await store.load();
    expect(diagram).toEqual(emptyDiagram());
  });

  it('saves and loads a diagram', async () => {
    const filePath = join(tempDir, 'test.erd.json');
    const store = new DiagramStore(filePath);

    const diagram: Diagram = {
      ...emptyDiagram(),
      name: 'Test',
      tables: {
        users: {
          columns: [{ name: 'id', type: 'uuid', primary: true }],
        },
      },
    };

    await store.save(diagram);
    const loaded = await store.load();
    expect(loaded).toEqual(diagram);
  });

  it('writes valid JSON to disk', async () => {
    const filePath = join(tempDir, 'test.erd.json');
    const store = new DiagramStore(filePath);
    await store.save(emptyDiagram());

    const raw = await readFile(filePath, 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('throws on corrupt JSON', async () => {
    const filePath = join(tempDir, 'corrupt.erd.json');
    await writeFile(filePath, 'not json!!!', 'utf-8');

    const store = new DiagramStore(filePath);
    await expect(store.load()).rejects.toThrow('Invalid JSON');
  });

  it('throws on invalid schema', async () => {
    const filePath = join(tempDir, 'bad.erd.json');
    await writeFile(filePath, '{"format":"wrong","tables":{},"relations":[]}', 'utf-8');

    const store = new DiagramStore(filePath);
    await expect(store.load()).rejects.toThrow('Invalid schema');
  });
});
