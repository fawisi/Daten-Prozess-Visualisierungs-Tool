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
      'Tabelle users hat id. Dies ist kein nutzbarer Erkennungssatz.'
    );
    expect(unparsedSpans.length).toBe(1);
  });
});

describe('parseDiagramDescription — DE relation patterns (CR-5)', () => {
  it('"Kunden haben mehrere Bestellungen." auto-creates both tables + 1:N relation', () => {
    const { diagram, stats } = parseDiagramDescription(
      'Kunden haben mehrere Bestellungen.'
    );
    expect(diagram.tables.kunden).toBeDefined();
    expect(diagram.tables.bestellungen).toBeDefined();
    expect(diagram.tables.bestellungen.columns.some((c) => c.name === 'kunden_id')).toBe(true);
    expect(diagram.relations).toHaveLength(1);
    expect(diagram.relations[0].type).toBe('many-to-one');
    expect(stats.tablesAdded).toBe(2);
    expect(stats.relationsAdded).toBe(1);
  });

  it('"Bestellungen gehoeren zu einem Kunden." creates N:1 with parent on the right', () => {
    const { diagram, stats } = parseDiagramDescription(
      'Bestellungen gehoeren zu einem Kunden.'
    );
    expect(diagram.tables.bestellungen.columns.some((c) => c.name === 'kunden_id')).toBe(true);
    expect(diagram.relations[0].to.table).toBe('kunden');
    expect(stats.relationsAdded).toBe(1);
  });

  it('handles the umlaut form "gehören zu einem"', () => {
    const { diagram } = parseDiagramDescription(
      'Bestellungen gehören zu einem Kunden.'
    );
    expect(diagram.relations[0].from.table).toBe('bestellungen');
    expect(diagram.relations[0].to.table).toBe('kunden');
  });

  it('"Order referenziert Customer ueber customer_id." uses the explicit FK column', () => {
    const { diagram } = parseDiagramDescription(
      'Order referenziert Customer ueber customer_id.'
    );
    const fk = diagram.tables.order.columns.find((c) => c.name === 'customer_id');
    expect(fk).toBeDefined();
    expect(diagram.relations[0].from.column).toBe('customer_id');
  });

  it('"Jede Bestellung enthaelt mehrere Bestellpositionen." captures parent → child', () => {
    const { diagram } = parseDiagramDescription(
      'Jede Bestellung enthält mehrere Bestellpositionen.'
    );
    expect(diagram.tables.bestellung).toBeDefined();
    expect(diagram.tables.bestellpositionen).toBeDefined();
    expect(diagram.relations[0].to.table).toBe('bestellung');
  });

  it('"Produkte sind einer Kategorie zugeordnet." captures N:1', () => {
    const { diagram } = parseDiagramDescription(
      'Produkte sind einer Kategorie zugeordnet.'
    );
    expect(diagram.tables.produkte).toBeDefined();
    expect(diagram.tables.kategorie).toBeDefined();
    expect(diagram.relations[0].from.table).toBe('produkte');
    expect(diagram.relations[0].to.table).toBe('kategorie');
  });

  it('combines a Tabelle-pattern with a relation in one parse call', () => {
    const { diagram, stats } = parseDiagramDescription(
      'Tabelle kunden hat id, name. Kunden haben mehrere bestellungen.'
    );
    expect(diagram.tables.kunden.columns.find((c) => c.name === 'name')).toBeDefined();
    expect(diagram.tables.bestellungen).toBeDefined();
    expect(stats.relationsAdded).toBe(1);
  });

  it('relation patterns are idempotent — re-parsing same text adds no duplicates', () => {
    const first = parseDiagramDescription('Kunden haben mehrere Bestellungen.');
    const second = parseDiagramDescription(
      'Kunden haben mehrere Bestellungen.',
      undefined,
      first.diagram
    );
    expect(second.diagram.relations).toHaveLength(1);
    expect(second.stats.relationsAdded).toBe(0);
  });

  it('hits the user-test 5-sample corpus baseline (>= 4/5 patterns recognised)', () => {
    const corpus = [
      'Kunden haben mehrere Bestellungen.',
      'Bestellungen gehoeren zu einem Kunden.',
      'Order referenziert Customer ueber customer_id.',
      'Jede Bestellung enthält mehrere Bestellpositionen.',
      'Produkte sind einer Kategorie zugeordnet.',
    ];
    let recognised = 0;
    for (const line of corpus) {
      const { stats } = parseDiagramDescription(line);
      if (stats.relationsAdded > 0) recognised += 1;
    }
    expect(recognised).toBeGreaterThanOrEqual(4);
  });
});
