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
