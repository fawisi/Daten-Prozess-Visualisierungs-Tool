import { describe, it, expect } from 'vitest';
import { toMermaid } from './mermaid.js';
import { emptyDiagram } from '../schema.js';
import type { Diagram } from '../schema.js';

describe('toMermaid', () => {
  it('produces valid erDiagram header', () => {
    const diagram: Diagram = {
      ...emptyDiagram(),
      tables: {
        users: { columns: [{ name: 'id', type: 'uuid', primary: true }] },
      },
    };
    const result = toMermaid(diagram);
    expect(result).toMatch(/^erDiagram\n/);
  });

  it('includes tables and columns', () => {
    const diagram: Diagram = {
      ...emptyDiagram(),
      tables: {
        users: {
          columns: [
            { name: 'id', type: 'uuid', primary: true },
            { name: 'email', type: 'varchar' },
          ],
        },
      },
    };
    const result = toMermaid(diagram);
    expect(result).toContain('users {');
    expect(result).toContain('uuid id PK');
    expect(result).toContain('varchar email');
  });

  it('includes relations with cardinality', () => {
    const diagram: Diagram = {
      ...emptyDiagram(),
      tables: {
        users: { columns: [{ name: 'id', type: 'uuid', primary: true }] },
        orders: {
          columns: [
            { name: 'id', type: 'uuid', primary: true },
            { name: 'user_id', type: 'uuid' },
          ],
        },
      },
      relations: [
        {
          from: { table: 'orders', column: 'user_id' },
          to: { table: 'users', column: 'id' },
          type: 'many-to-one',
        },
      ],
    };
    const result = toMermaid(diagram);
    expect(result).toContain('orders }o--|| users');
  });

  it('sorts tables and relations for deterministic output', () => {
    const diagram: Diagram = {
      ...emptyDiagram(),
      tables: {
        zebra: { columns: [{ name: 'id', type: 'int' }] },
        alpha: { columns: [{ name: 'id', type: 'int' }] },
      },
    };
    const result = toMermaid(diagram);
    const lines = result.split('\n');
    const alphaIdx = lines.findIndex((l) => l.includes('alpha {'));
    const zebraIdx = lines.findIndex((l) => l.includes('zebra {'));
    expect(alphaIdx).toBeLessThan(zebraIdx);
  });

  it('marks NOT NULL columns', () => {
    const diagram: Diagram = {
      ...emptyDiagram(),
      tables: {
        t: { columns: [{ name: 'x', type: 'int', nullable: false }] },
      },
    };
    const result = toMermaid(diagram);
    expect(result).toContain('"NOT NULL"');
  });

  it('wraps body in %%{init}%% when theme option is set', () => {
    const diagram: Diagram = {
      ...emptyDiagram(),
      tables: { t: { columns: [{ name: 'id', type: 'int', primary: true }] } },
    };
    const result = toMermaid(diagram, { theme: 'light' });
    expect(result.startsWith('%%{init:')).toBe(true);
    expect(result).toContain('"theme": "base"');
    expect(result).toContain('"background":"#FFFFFF"');
    expect(result).toContain('erDiagram');
  });
});
