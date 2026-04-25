import { describe, it, expect } from 'vitest';
import { parseDiagramDescription } from './parse-description.js';

describe('parseDiagramDescription — ERD narrative', () => {
  it('creates a table from "Tabelle users hat id, email, name"', () => {
    const { diagram, stats } = parseDiagramDescription(
      'Tabelle users hat id, email, name.'
    );
    expect(diagram.tables.users).toBeDefined();
    expect(diagram.tables.users.columns.map((c) => c.name)).toEqual(['id', 'email', 'name']);
    expect(diagram.tables.users.columns[0].primary).toBe(true);
    expect(stats.tablesAdded).toBe(1);
    expect(stats.columnsAdded).toBe(3);
  });

  it('supports "als <typ>" column syntax', () => {
    const { diagram } = parseDiagramDescription(
      'Tabelle orders hat id als uuid, total als numeric.'
    );
    const total = diagram.tables.orders.columns.find((c) => c.name === 'total');
    expect(total?.type).toBe('numeric');
    const id = diagram.tables.orders.columns.find((c) => c.name === 'id');
    expect(id?.type).toBe('uuid');
  });

  it('first column becomes primary when no id field exists', () => {
    const { diagram } = parseDiagramDescription(
      'Tabelle logs hat timestamp, message.'
    );
    expect(diagram.tables.logs.columns[0].primary).toBe(true);
  });

  it('merges columns idempotently when re-parsing same text', () => {
    const first = parseDiagramDescription('Tabelle users hat id, email.');
    const second = parseDiagramDescription(
      'Tabelle users hat id, email.',
      { engine: 'regex' },
      first.diagram
    );
    expect(second.diagram.tables.users.columns.length).toBe(2);
    expect(second.stats.columnsAdded).toBe(0);
  });

  it('degrades engine=llm to regex with a warning', () => {
    const { engineUsed, warnings } = parseDiagramDescription(
      'Tabelle users hat id.',
      { engine: 'llm' }
    );
    expect(engineUsed).toBe('regex');
    expect(warnings.some((w) => /falling back/i.test(w))).toBe(true);
  });

  it('collects unparsedSpans for lines with no match', () => {
    const { unparsedSpans } = parseDiagramDescription(
      'Tabelle users hat id. Dies ist kein Tabellensatz.'
    );
    expect(unparsedSpans.length).toBe(1);
  });
});
