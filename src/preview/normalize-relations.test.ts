import { describe, it, expect } from 'vitest';
import { normalizeRelations } from './normalize-relations.js';

describe('normalizeRelations', () => {
  it('rewrites legacy { from: string, fromColumn, to: string, toColumn, cardinality }', () => {
    const doc = {
      relations: [
        {
          from: 'Junction_Problem_UC',
          fromColumn: 'problem_id',
          to: 'Probleme',
          toColumn: 'id',
          cardinality: 'N:1',
        },
      ],
    };
    normalizeRelations(doc);
    expect(doc.relations[0]).toEqual({
      from: { table: 'Junction_Problem_UC', column: 'problem_id' },
      to: { table: 'Probleme', column: 'id' },
      type: 'many-to-one',
    });
  });

  it('passes through canonical relations untouched', () => {
    const doc = {
      relations: [
        {
          from: { table: 'a', column: 'b' },
          to: { table: 'c', column: 'd' },
          type: 'one-to-many',
        },
      ],
    };
    const before = JSON.stringify(doc);
    normalizeRelations(doc);
    expect(JSON.stringify(doc)).toBe(before);
  });

  it('maps every short cardinality to its long form', () => {
    const cases: Array<['1:1' | '1:N' | 'N:1' | 'N:N', string]> = [
      ['1:1', 'one-to-one'],
      ['1:N', 'one-to-many'],
      ['N:1', 'many-to-one'],
      ['N:N', 'many-to-many'],
    ];
    for (const [short, long] of cases) {
      const doc = {
        relations: [
          { from: 'a', fromColumn: 'x', to: 'b', toColumn: 'y', cardinality: short },
        ],
      };
      normalizeRelations(doc);
      expect((doc.relations[0] as { type: string }).type).toBe(long);
    }
  });

  it('drops legacy fields after rewrite', () => {
    const doc = {
      relations: [
        { from: 'a', fromColumn: 'x', to: 'b', toColumn: 'y', cardinality: 'N:1' },
      ],
    };
    normalizeRelations(doc);
    const r = doc.relations[0] as Record<string, unknown>;
    expect('fromColumn' in r).toBe(false);
    expect('toColumn' in r).toBe(false);
    expect('cardinality' in r).toBe(false);
  });

  it('leaves unknown shapes alone so Zod can still trip on them', () => {
    const doc = { relations: [{ wat: 'this is not a relation' }] };
    normalizeRelations(doc);
    expect(doc.relations[0]).toEqual({ wat: 'this is not a relation' });
  });

  it('tolerates docs without a relations array', () => {
    expect(() => normalizeRelations({} as { relations?: unknown })).not.toThrow();
    expect(() => normalizeRelations({ relations: null } as { relations?: unknown })).not.toThrow();
  });
});
