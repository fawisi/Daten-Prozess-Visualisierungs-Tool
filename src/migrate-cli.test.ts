import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateFile, runMigrateCli } from './migrate-cli.js';
import { DbmlStore } from './dbml-store.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'viso-migrate-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const LEGACY_JSON = {
  format: 'daten-viz-erd-v1' as const,
  name: 'Demo',
  tables: {
    users: {
      columns: [
        { name: 'id', type: 'uuid', primary: true },
        { name: 'email', type: 'varchar(255)', nullable: false, description: 'Login' },
      ],
      description: 'App users',
    },
    orders: {
      columns: [
        { name: 'id', type: 'uuid', primary: true },
        { name: 'user_id', type: 'uuid', nullable: false },
      ],
    },
  },
  relations: [
    {
      from: { table: 'orders', column: 'user_id' },
      to: { table: 'users', column: 'id' },
      type: 'many-to-one' as const,
    },
  ],
};

describe('migrateFile', () => {
  it('migrates a legacy daten-viz-erd-v1 file to DBML', async () => {
    const source = join(tempDir, 'schema.erd.json');
    await writeFile(source, JSON.stringify(LEGACY_JSON, null, 2));

    const result = await migrateFile(source);

    expect(result.tableCount).toBe(2);
    expect(result.relationCount).toBe(1);
    expect(result.noteTruncations).toEqual([]);

    const dbml = await readFile(result.dbmlPath, 'utf-8');
    expect(dbml).toContain('Table users');
    expect(dbml).toContain('Ref: orders.user_id > users.id');

    // Reload via DbmlStore to confirm roundtrip
    const diagram = await new DbmlStore(result.dbmlPath).load();
    expect(diagram.format).toBe('viso-erd-v1');
    expect(Object.keys(diagram.tables)).toEqual(['users', 'orders']);
  });

  it('creates a .bak next to the original and keeps the original file', async () => {
    const source = join(tempDir, 'schema.erd.json');
    await writeFile(source, JSON.stringify(LEGACY_JSON));

    const result = await migrateFile(source);

    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(tempDir);
    expect(entries).toContain('schema.erd.json');
    expect(entries).toContain('schema.erd.json.bak');
    expect(entries).toContain('schema.dbml');
    expect(result.backupPath).toBe(source + '.bak');
  });

  it('rejects a file that does not end in .erd.json', async () => {
    const source = join(tempDir, 'schema.json');
    await writeFile(source, JSON.stringify(LEGACY_JSON));
    await expect(migrateFile(source)).rejects.toThrow(/Expected a legacy/);
  });

  it('rejects a JSON file that is not in the daten-viz-erd-v1 shape', async () => {
    const source = join(tempDir, 'other.erd.json');
    await writeFile(source, JSON.stringify({ format: 'viso-erd-v1', tables: {}, relations: [] }));
    await expect(migrateFile(source)).rejects.toThrow(/not a valid daten-viz-erd-v1/i);
  });

  it('truncates notes longer than 200 chars and records the location', async () => {
    const longNote = 'x'.repeat(450);
    const source = join(tempDir, 'long-note.erd.json');
    const payload = {
      ...LEGACY_JSON,
      tables: {
        ...LEGACY_JSON.tables,
        users: {
          ...LEGACY_JSON.tables.users,
          description: longNote,
        },
      },
    };
    await writeFile(source, JSON.stringify(payload));

    const result = await migrateFile(source);
    expect(result.noteTruncations.length).toBeGreaterThan(0);
    expect(result.noteTruncations[0]).toContain('tables.users');
    expect(result.noteTruncations[0]).toContain('450 chars');
  });
});

describe('runMigrateCli', () => {
  it('returns non-zero when no arguments are given', async () => {
    const code = await runMigrateCli([]);
    expect(code).toBe(2);
  });

  it('returns non-zero when the file cannot be migrated', async () => {
    const code = await runMigrateCli([join(tempDir, 'does-not-exist.erd.json')]);
    expect(code).toBe(1);
  });

  it('returns 0 when a file migrates successfully', async () => {
    const source = join(tempDir, 'schema.erd.json');
    await writeFile(source, JSON.stringify(LEGACY_JSON));
    const code = await runMigrateCli([source]);
    expect(code).toBe(0);
  });
});
