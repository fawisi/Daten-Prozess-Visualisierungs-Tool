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

  it('ignores label updates (table rename is unsupported here)', () => {
    const doc = fixtureDiagram();
    applyErdTableUpdate(doc, 'users', { label: 'people' });
    // Table key is unchanged
    expect(doc.tables.users).toBeDefined();
    expect(doc.tables.people).toBeUndefined();
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
