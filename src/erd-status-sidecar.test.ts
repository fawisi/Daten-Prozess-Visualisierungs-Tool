import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyStatusSidecar,
  loadErdStatusSidecar,
  pruneErdStatusSidecar,
  updateColumnStatus,
  updateTableStatus,
} from './erd-status-sidecar.js';
import { emptyDiagram } from './schema.js';
import type { Diagram } from './schema.js';

describe('ERD status sidecar', () => {
  let dir: string;
  let sourcePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'viso-erd-status-'));
    sourcePath = join(dir, 'schema.dbml');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('loadErdStatusSidecar returns empty object when sidecar does not exist', async () => {
    const loaded = await loadErdStatusSidecar(sourcePath);
    expect(loaded.tables).toEqual({});
    expect(loaded.columns).toEqual({});
  });

  it('updateTableStatus persists status to sidecar', async () => {
    await updateTableStatus(sourcePath, 'users', 'blocked');
    const loaded = await loadErdStatusSidecar(sourcePath);
    expect(loaded.tables.users).toBe('blocked');
  });

  it('updateTableStatus with null clears the status', async () => {
    await updateTableStatus(sourcePath, 'users', 'blocked');
    await updateTableStatus(sourcePath, 'users', null);
    const loaded = await loadErdStatusSidecar(sourcePath);
    expect(loaded.tables.users).toBeUndefined();
  });

  it('updateColumnStatus stores under "table.column" key', async () => {
    await updateColumnStatus(sourcePath, 'users', 'email', 'done');
    const loaded = await loadErdStatusSidecar(sourcePath);
    expect(loaded.columns['users.email']).toBe('done');
  });

  it('applyStatusSidecar hydrates a diagram with sidecar data', async () => {
    await updateTableStatus(sourcePath, 'users', 'blocked');
    await updateColumnStatus(sourcePath, 'users', 'email', 'done');
    const diagram: Diagram = {
      format: 'viso-erd-v1',
      tables: {
        users: {
          columns: [
            { name: 'id', type: 'uuid', primary: true },
            { name: 'email', type: 'varchar' },
          ],
        },
      },
      relations: [],
    };
    const sidecar = await loadErdStatusSidecar(sourcePath);
    applyStatusSidecar(diagram, sidecar);
    expect(diagram.tables.users.status).toBe('blocked');
    expect(diagram.tables.users.columns[1].status).toBe('done');
  });

  it('pruneErdStatusSidecar removes entries whose targets disappeared', async () => {
    await updateTableStatus(sourcePath, 'users', 'open');
    await updateTableStatus(sourcePath, 'orders', 'blocked');
    await updateColumnStatus(sourcePath, 'users', 'email', 'done');
    await updateColumnStatus(sourcePath, 'orders', 'total', 'open');

    // Only "users" survives with only an "id" column
    const diagram: Diagram = {
      format: 'viso-erd-v1',
      tables: {
        users: { columns: [{ name: 'id', type: 'uuid', primary: true }] },
      },
      relations: [],
    };
    const removed = await pruneErdStatusSidecar(sourcePath, diagram);
    expect(removed.sort()).toEqual(
      ['column:orders.total', 'column:users.email', 'table:orders'].sort()
    );

    const after = await loadErdStatusSidecar(sourcePath);
    expect(after.tables.users).toBe('open');
    expect(after.tables.orders).toBeUndefined();
    expect(after.columns['users.email']).toBeUndefined();
  });

  it('saves JSON file with newline suffix', async () => {
    await updateTableStatus(sourcePath, 'x', 'open');
    const raw = await readFile(
      sourcePath.replace(/\.dbml$/, '.erd.status.json'),
      'utf-8'
    );
    expect(raw.endsWith('\n')).toBe(true);
  });

  it('applyStatusSidecar with empty sidecar leaves diagram untouched', async () => {
    const d = emptyDiagram();
    d.tables.users = { columns: [{ name: 'id', type: 'uuid' }] };
    const before = JSON.stringify(d);
    const sidecar = await loadErdStatusSidecar(sourcePath);
    applyStatusSidecar(d, sidecar);
    expect(JSON.stringify(d)).toBe(before);
  });
});
