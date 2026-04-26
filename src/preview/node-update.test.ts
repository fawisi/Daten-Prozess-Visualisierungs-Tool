import { describe, it, expect } from 'vitest';
import { applyErdTableUpdate, applyLandscapeNodeUpdate } from './node-update.js';
import type { Diagram } from '../schema.js';
import type { Landscape } from '../landscape/schema.js';

function fixtureDiagram(): Diagram {
  return {
    format: 'viso-erd-v1',
    tables: {
      users: {
        columns: [{ name: 'id', type: 'uuid', primary: true }],
        description: 'Existing description',
        status: 'open',
      },
      orders: {
        columns: [{ name: 'id', type: 'uuid', primary: true }],
      },
    },
    relations: [],
  };
}

function fixtureLandscape(): Landscape {
  return {
    format: 'viso-landscape-v1',
    nodes: {
      shop: {
        kind: 'system',
        label: 'Shop',
        description: 'Existing',
        status: 'open',
      },
      api: {
        kind: 'system',
        label: 'API',
      },
    },
    relations: [],
  };
}

describe('applyErdTableUpdate', () => {
  it('updates description on an existing table', () => {
    const doc = fixtureDiagram();
    applyErdTableUpdate(doc, 'users', { description: 'New text' });
    expect(doc.tables.users!.description).toBe('New text');
  });

  it('removes description when set to empty string', () => {
    const doc = fixtureDiagram();
    applyErdTableUpdate(doc, 'users', { description: '' });
    expect(doc.tables.users!.description).toBeUndefined();
  });

  it('updates status on an existing table', () => {
    const doc = fixtureDiagram();
    applyErdTableUpdate(doc, 'users', { status: 'done' });
    expect(doc.tables.users!.status).toBe('done');
  });

  it('clears status when set to null', () => {
    const doc = fixtureDiagram();
    applyErdTableUpdate(doc, 'users', { status: null });
    expect(doc.tables.users!.status).toBeUndefined();
  });

  it('renames the table when label is a valid new identifier (B1)', () => {
    const doc = fixtureDiagram();
    applyErdTableUpdate(doc, 'users', { label: 'people' });
    expect(doc.tables.users).toBeUndefined();
    expect(doc.tables.people).toBeDefined();
    // Description and columns survive the rename intact.
    expect(doc.tables.people!.description).toBe('Existing description');
    expect(doc.tables.people!.status).toBe('open');
    expect(doc.tables.people!.columns[0]!.name).toBe('id');
  });

  it('no-ops on rename when label equals the current id (B1)', () => {
    const doc = fixtureDiagram();
    const before = JSON.stringify(doc);
    applyErdTableUpdate(doc, 'users', { label: 'users' });
    expect(JSON.stringify(doc)).toBe(before);
  });

  it('no-ops on rename when target key already exists (B1)', () => {
    const doc = fixtureDiagram();
    applyErdTableUpdate(doc, 'users', { label: 'orders' });
    // Both tables remain, neither was overwritten.
    expect(doc.tables.users).toBeDefined();
    expect(doc.tables.users!.description).toBe('Existing description');
    expect(doc.tables.orders).toBeDefined();
    expect(doc.tables.orders!.description).toBeUndefined();
  });

  it('no-ops on rename when label is not a SafeIdentifier (B1)', () => {
    const doc = fixtureDiagram();
    applyErdTableUpdate(doc, 'users', { label: '1bad-name' });
    expect(doc.tables.users).toBeDefined();
    expect(doc.tables['1bad-name']).toBeUndefined();
  });

  it('no-ops on rename when label is empty (B1)', () => {
    const doc = fixtureDiagram();
    applyErdTableUpdate(doc, 'users', { label: '' });
    expect(doc.tables.users).toBeDefined();
    expect(doc.tables['']).toBeUndefined();
  });

  it('rewrites every relation pointing at the old key on rename (B1)', () => {
    const doc = fixtureDiagram();
    doc.relations = [
      {
        from: { table: 'users', column: 'id' },
        to: { table: 'orders', column: 'user_id' },
        type: 'one-to-many',
      },
      {
        from: { table: 'orders', column: 'user_id' },
        to: { table: 'users', column: 'id' },
        type: 'many-to-one',
      },
    ];
    applyErdTableUpdate(doc, 'users', { label: 'people' });
    expect(doc.relations[0]!.from.table).toBe('people');
    expect(doc.relations[0]!.to.table).toBe('orders');
    expect(doc.relations[1]!.from.table).toBe('orders');
    expect(doc.relations[1]!.to.table).toBe('people');
  });

  it('applies description and rename in the same NodeUpdate batch (B1)', () => {
    const doc = fixtureDiagram();
    applyErdTableUpdate(doc, 'users', {
      label: 'people',
      description: 'Renamed + redescribed',
    });
    expect(doc.tables.users).toBeUndefined();
    expect(doc.tables.people!.description).toBe('Renamed + redescribed');
  });

  it('no-ops for unknown table ids', () => {
    const doc = fixtureDiagram();
    const before = JSON.stringify(doc);
    applyErdTableUpdate(doc, 'nonexistent', { description: 'X' });
    expect(JSON.stringify(doc)).toBe(before);
  });

  it('leaves untouched fields alone when only one key is mutated', () => {
    const doc = fixtureDiagram();
    applyErdTableUpdate(doc, 'users', { description: 'Updated' });
    expect(doc.tables.users!.status).toBe('open');
  });

  it('replaces the full columns array on a columns update (MA-11)', () => {
    const doc = fixtureDiagram();
    applyErdTableUpdate(doc, 'users', {
      columns: [
        { name: 'id', type: 'uuid', primary: true },
        { name: 'email', type: 'varchar' },
        { name: 'created_at', type: 'timestamp' },
      ],
    });
    expect(doc.tables.users!.columns).toHaveLength(3);
    expect(doc.tables.users!.columns[1]!.name).toBe('email');
  });

  it('preserves description+status on existing columns when round-tripped (MA-11)', () => {
    const doc = fixtureDiagram();
    // Put a column with audit metadata in place first.
    doc.tables.users!.columns = [
      {
        name: 'id',
        type: 'uuid',
        primary: true,
        description: 'Primary id',
        status: 'done',
      },
    ];
    // Caller (PropertiesPanel) round-trips the full Column shape.
    applyErdTableUpdate(doc, 'users', {
      columns: [...doc.tables.users!.columns],
    });
    expect(doc.tables.users!.columns[0]!.description).toBe('Primary id');
    expect(doc.tables.users!.columns[0]!.status).toBe('done');
  });
});

describe('applyLandscapeNodeUpdate', () => {
  it('updates the node label', () => {
    const doc = fixtureLandscape();
    applyLandscapeNodeUpdate(doc, 'shop', { label: 'Web Shop' });
    expect(doc.nodes.shop!.label).toBe('Web Shop');
  });

  it('updates description and clears it on empty string', () => {
    const doc = fixtureLandscape();
    applyLandscapeNodeUpdate(doc, 'shop', { description: '' });
    expect(doc.nodes.shop!.description).toBeUndefined();
  });

  it('updates and clears status', () => {
    const doc = fixtureLandscape();
    applyLandscapeNodeUpdate(doc, 'shop', { status: 'blocked' });
    expect(doc.nodes.shop!.status).toBe('blocked');
    applyLandscapeNodeUpdate(doc, 'shop', { status: null });
    expect(doc.nodes.shop!.status).toBeUndefined();
  });

  it('no-ops for unknown node ids', () => {
    const doc = fixtureLandscape();
    const before = JSON.stringify(doc);
    applyLandscapeNodeUpdate(doc, 'ghost', { label: 'Ghost' });
    expect(JSON.stringify(doc)).toBe(before);
  });
});
