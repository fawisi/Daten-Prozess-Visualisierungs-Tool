import { describe, it, expect } from 'vitest';
import { parseProcessDescription } from './parse-description.js';

describe('parseProcessDescription — German narrative', () => {
  it('builds a start + task sequence from "Zuerst X. Dann Y."', () => {
    const { process, stats } = parseProcessDescription(
      'Zuerst Kunde erfassen. Dann Angebot schicken.'
    );
    const types = Object.values(process.nodes).map((n) => n.type);
    expect(types).toContain('start-event');
    expect(types.filter((t) => t === 'task').length).toBe(2);
    expect(process.flows.length).toBeGreaterThanOrEqual(2);
    expect(stats.patternHits.first).toBe(1);
    expect(stats.patternHits.next).toBe(1);
  });

  it('adds an end-event on "Am Ende"', () => {
    const { process } = parseProcessDescription(
      'Zuerst Antrag pruefen. Am Ende Entscheidung mitteilen.'
    );
    const types = Object.values(process.nodes).map((n) => n.type);
    expect(types).toContain('end-event');
  });

  it('emits an XOR gateway + yes/no branches from "Wenn … dann … sonst …"', () => {
    const { process, stats } = parseProcessDescription(
      'Zuerst Antrag pruefen. Wenn genehmigt dann Rechnung erstellen sonst Antrag ablehnen.'
    );
    const gw = Object.values(process.nodes).find((n) => n.type === 'gateway');
    expect(gw).toBeDefined();
    expect(stats.patternHits.gateway).toBe(1);
    // Both yes + no flows emitted.
    const labels = process.flows.map((f) => f.label).filter(Boolean);
    expect(labels).toContain('ja');
    expect(labels).toContain('nein');
  });

  it('degrades engine=llm to regex with a warning', () => {
    const { engineUsed, warnings } = parseProcessDescription(
      'Zuerst Start.',
      { engine: 'llm' }
    );
    expect(engineUsed).toBe('regex');
    expect(warnings.some((w) => /falling back to regex/i.test(w))).toBe(true);
  });

  it('idempotent: re-parsing same text into same base adds no new nodes/flows', () => {
    const { process: p1 } = parseProcessDescription(
      'Zuerst Angebot schreiben. Dann absenden.'
    );
    const { process: p2, stats } = parseProcessDescription(
      'Zuerst Angebot schreiben. Dann absenden.',
      { engine: 'regex' },
      p1
    );
    expect(Object.keys(p2.nodes).sort()).toEqual(Object.keys(p1.nodes).sort());
    expect(p2.flows.length).toBe(p1.flows.length);
    expect(stats.nodesAdded).toBe(0);
    expect(stats.flowsAdded).toBe(0);
  });
});

describe('parseProcessDescription — DE v1.1.1 patterns (CR-5)', () => {
  it('"Lager uebergibt Ware an Versand." creates two tasks + flow with payload label', () => {
    const { process, stats } = parseProcessDescription(
      'Lager uebergibt Ware an Versand.'
    );
    const labels = Object.values(process.nodes).map((n) => n.label);
    expect(labels).toContain('Lager');
    expect(labels).toContain('Versand');
    expect(process.flows.some((f) => f.label === 'Ware')).toBe(true);
    expect(stats.patternHits.uebergibt).toBe(1);
  });

  it('handles the umlaut form "Lager übergibt"', () => {
    const { stats } = parseProcessDescription(
      'Lager übergibt Bestellung an Versand.'
    );
    expect(stats.patternHits.uebergibt).toBe(1);
  });

  it('"System ruft Auth fuer User." captures rpc-call', () => {
    const { stats, process } = parseProcessDescription(
      'System ruft Auth fuer User.'
    );
    expect(stats.patternHits.ruft_fuer).toBe(1);
    expect(process.flows.some((f) => f.label === 'Auth')).toBe(true);
  });

  it('"Webshop sendet Bestaetigung via Email." channels the message', () => {
    const { stats, process } = parseProcessDescription(
      'Webshop sendet Bestaetigung via Email.'
    );
    expect(stats.patternHits.sendet_via).toBe(1);
    expect(process.flows.some((f) => f.label === 'Bestaetigung')).toBe(true);
  });

  it('"Nach Pruefung folgt Versand." chains a sequence', () => {
    const { stats, process } = parseProcessDescription(
      'Nach Pruefung folgt Versand.'
    );
    expect(stats.patternHits.nach_folgt).toBe(1);
    expect(Object.values(process.nodes).map((n) => n.label)).toEqual(
      expect.arrayContaining(['Pruefung', 'Versand'])
    );
  });

  it('"System pruefe Lagerbestand" emits a single task labelled with the verb phrase', () => {
    const { stats, process } = parseProcessDescription(
      'System prueft Lagerbestand.'
    );
    expect(stats.patternHits.prueft).toBe(1);
    expect(
      Object.values(process.nodes).some((n) => n.label.includes('prüft Lagerbestand'))
    ).toBe(true);
  });

  it('"Worker verarbeitet Job." emits a task', () => {
    const { stats } = parseProcessDescription('Worker verarbeitet Job.');
    expect(stats.patternHits.verarbeitet).toBe(1);
  });

  it('hits at least 6/7 patterns from the user-test corpus', () => {
    const corpus = [
      'Lager uebergibt Ware an Versand.',
      'System ruft Auth fuer User.',
      'Webshop sendet Bestaetigung via Email.',
      'Nach Pruefung folgt Versand.',
      'System prueft Lagerbestand.',
      'Worker verarbeitet Job.',
      'Zuerst Antrag erfassen. Dann pruefen.',
    ];
    let recognised = 0;
    for (const line of corpus) {
      const { stats } = parseProcessDescription(line);
      if (stats.nodesAdded > 0 || stats.flowsAdded > 0) recognised += 1;
    }
    expect(recognised).toBeGreaterThanOrEqual(6);
  });

  it('combines a v1.0 sequence with a v1.1.1 uebergibt-pattern in one parse call', () => {
    const { process } = parseProcessDescription(
      'Zuerst Bestellung erfassen. Lager uebergibt Ware an Versand.'
    );
    const labels = Object.values(process.nodes).map((n) => n.label);
    expect(labels).toContain('Lager');
    expect(labels).toContain('Versand');
  });
});
