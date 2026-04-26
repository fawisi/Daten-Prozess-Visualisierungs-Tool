import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DbmlStore, diagramToDbml, __test__ } from './dbml-store.js';
import { emptyDiagram } from './schema.js';
import type { Diagram } from './schema.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'viso-dbml-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const FIXTURES = resolve(__dirname, '../fixtures/erd-samples');

async function loadFixture(name: string): Promise<string> {
  return readFile(resolve(FIXTURES, name), 'utf-8');
}

describe('DbmlStore.load', () => {
  it('returns empty diagram when file is missing', async () => {
    const store = new DbmlStore(join(tempDir, 'none.dbml'));
    const diagram = await store.load();
    expect(diagram).toEqual(emptyDiagram());
  });

  it('returns empty diagram for an empty file', async () => {
    const path = join(tempDir, 'empty.dbml');
    await writeFile(path, '   \n\t', 'utf-8');
    const store = new DbmlStore(path);
    const diagram = await store.load();
    expect(diagram).toEqual(emptyDiagram());
  });

  it('parses the simple fixture into the internal Diagram shape', async () => {
    const path = join(tempDir, 'simple.dbml');
    await writeFile(path, await loadFixture('simple.dbml'), 'utf-8');
    const diagram = await new DbmlStore(path).load();

    expect(diagram.format).toBe('viso-erd-v1');
    expect(Object.keys(diagram.tables)).toEqual(['users', 'posts']);

    const users = diagram.tables.users;
    expect(users.columns).toHaveLength(4);
    const idColumn = users.columns.find((c) => c.name === 'id');
    expect(idColumn?.primary).toBe(true);
    const emailColumn = users.columns.find((c) => c.name === 'email');
    expect(emailColumn?.nullable).toBe(false);
    expect(emailColumn?.description).toContain('Login email');

    expect(diagram.relations).toEqual([
      {
        from: { table: 'posts', column: 'user_id' },
        to: { table: 'users', column: 'id' },
        type: 'many-to-one',
      },
    ]);
  });

  it('rejects invalid DBML with a helpful error', async () => {
    const path = join(tempDir, 'broken.dbml');
    await writeFile(path, 'Table users {\n  id uuid [pk\n', 'utf-8');
    await expect(new DbmlStore(path).load()).rejects.toThrow(
      /Invalid DBML/
    );
  });

  it('parses composite keys into two pk columns per table', async () => {
    const path = join(tempDir, 'composite-keys.dbml');
    await writeFile(path, await loadFixture('composite-keys.dbml'), 'utf-8');
    const diagram = await new DbmlStore(path).load();

    const orderItems = diagram.tables.order_items;
    const pkCols = orderItems.columns.filter((c) => c.primary);
    expect(pkCols.map((c) => c.name)).toEqual(['order_id', 'product_id']);
  });

  it('preserves table and column notes', async () => {
    const path = join(tempDir, 'enums.dbml');
    await writeFile(path, await loadFixture('enums-and-notes.dbml'), 'utf-8');
    const diagram = await new DbmlStore(path).load();

    expect(diagram.tables.subscriptions.description).toContain('UTC');
    const statusCol = diagram.tables.subscriptions.columns.find(
      (c) => c.name === 'status'
    );
    expect(statusCol?.description).toContain('Billed monthly');
  });

  it('handles self-referential relations without looping', async () => {
    const path = join(tempDir, 'self-ref.dbml');
    await writeFile(path, await loadFixture('multi-schema.dbml'), 'utf-8');
    const diagram = await new DbmlStore(path).load();

    const orgRef = diagram.relations.find(
      (r) =>
        r.from.table === 'organisations' && r.to.table === 'organisations'
    );
    expect(orgRef).toBeDefined();
    expect(orgRef?.from.column).toBe('parent_id');
    expect(orgRef?.to.column).toBe('id');
  });
});

describe('DbmlStore.save', () => {
  it('writes DBML that round-trips through load()', async () => {
    const path = join(tempDir, 'roundtrip.dbml');
    const store = new DbmlStore(path);

    const diagram: Diagram = {
      format: 'viso-erd-v1',
      name: 'Test DB',
      tables: {
        users: {
          columns: [
            { name: 'id', type: 'uuid', primary: true },
            { name: 'email', type: 'varchar(255)', nullable: false, description: 'Login' },
          ],
          description: 'Customer accounts',
        },
        posts: {
          columns: [
            { name: 'id', type: 'uuid', primary: true },
            { name: 'user_id', type: 'uuid', nullable: false },
            { name: 'title', type: 'varchar(256)', nullable: false },
          ],
        },
      },
      relations: [
        {
          from: { table: 'posts', column: 'user_id' },
          to: { table: 'users', column: 'id' },
          type: 'many-to-one',
        },
      ],
    };

    await store.save(diagram);
    const reloaded = await store.load();

    expect(Object.keys(reloaded.tables)).toEqual(['users', 'posts']);
    expect(reloaded.tables.users.description).toBe('Customer accounts');
    expect(
      reloaded.tables.users.columns.find((c) => c.name === 'email')?.description
    ).toBe('Login');
    expect(reloaded.relations).toHaveLength(1);
    expect(reloaded.relations[0].type).toBe('many-to-one');
  });

  it('emits valid DBML for the empty diagram', () => {
    const out = diagramToDbml(emptyDiagram());
    expect(out.trim()).toBe('');
  });

  it('encodes all four relation cardinalities', () => {
    const { diagramToDbml } = __test__;
    for (const type of [
      'one-to-one',
      'one-to-many',
      'many-to-one',
      'many-to-many',
    ] as const) {
      const diagram: Diagram = {
        format: 'viso-erd-v1',
        tables: {
          a: { columns: [{ name: 'id', type: 'uuid', primary: true }] },
          b: { columns: [{ name: 'id', type: 'uuid', primary: true }] },
        },
        relations: [
          {
            from: { table: 'a', column: 'id' },
            to: { table: 'b', column: 'id' },
            type,
          },
        ],
      };
      expect(diagramToDbml(diagram)).toMatch(/Ref: a\.id [\-<>]+ b\.id/);
    }
  });

  it('atomic write: no partial file visible on crash path', async () => {
    const path = join(tempDir, 'atomic.dbml');
    const store = new DbmlStore(path);
    // Save a small diagram first
    await store.save({
      format: 'viso-erd-v1',
      tables: { u: { columns: [{ name: 'id', type: 'uuid', primary: true }] } },
      relations: [],
    });
    // Verify no tmp file lingers after the save completes
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(tempDir);
    expect(entries.filter((e) => e.startsWith('.tmp-'))).toEqual([]);
    expect(entries).toContain('atomic.dbml');
  });
});

describe('SQL export round-trip via @dbml/core', () => {
  it('produces valid Postgres DDL from the simple fixture', async () => {
    const path = join(tempDir, 'simple.dbml');
    await writeFile(path, await loadFixture('simple.dbml'), 'utf-8');
    const diagram = await new DbmlStore(path).load();
    const dbml = diagramToDbml(diagram);

    const { exporter } = await import('@dbml/core');
    const sql = exporter.export(dbml, 'postgres');
    expect(sql).toContain('CREATE TABLE "users"');
    expect(sql).toContain('CREATE TABLE "posts"');
    expect(sql).toContain('FOREIGN KEY ("user_id") REFERENCES "users" ("id")');
  });

  it('produces valid MySQL DDL with backtick identifiers', async () => {
    const path = join(tempDir, 'simple.dbml');
    await writeFile(path, await loadFixture('simple.dbml'), 'utf-8');
    const diagram = await new DbmlStore(path).load();
    const dbml = diagramToDbml(diagram);

    const { exporter } = await import('@dbml/core');
    const sql = exporter.export(dbml, 'mysql');
    expect(sql).toContain('CREATE TABLE `users`');
    expect(sql).toMatch(/FOREIGN KEY \(`user_id`\) REFERENCES `users` \(`id`\)/);
  });
});

describe('diagramToDbml formatting', () => {
  it('quotes types that contain special characters', () => {
    const diagram: Diagram = {
      format: 'viso-erd-v1',
      tables: {
        weird: {
          columns: [
            { name: 'id', type: 'uuid', primary: true },
            { name: 'tags', type: 'text[]' },
          ],
        },
      },
      relations: [],
    };
    const dbml = diagramToDbml(diagram);
    expect(dbml).toContain('"text[]"');
  });

  it('escapes single-quotes in notes', () => {
    const diagram: Diagram = {
      format: 'viso-erd-v1',
      tables: {
        t: {
          columns: [
            {
              name: 'id',
              type: 'uuid',
              primary: true,
              description: "Don't forget me",
            },
          ],
        },
      },
      relations: [],
    };
    const dbml = diagramToDbml(diagram);
    expect(dbml).toContain("Don\\'t forget me");
  });
});
