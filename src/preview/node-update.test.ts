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
