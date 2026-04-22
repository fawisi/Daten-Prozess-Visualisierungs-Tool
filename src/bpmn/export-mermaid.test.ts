import { describe, it, expect } from 'vitest';
import { processToMermaid } from './export-mermaid.js';
import type { Process } from './schema.js';

describe('processToMermaid', () => {
  const sampleProcess: Process = {
    format: 'viso-bpmn-v1',
    name: 'Order Process',
    nodes: {
      start: { type: 'start-event', label: 'Order received' },
      review: { type: 'task', label: 'Review order' },
      decision: { type: 'gateway', label: 'Approved?', gatewayType: 'exclusive' },
      fulfill: { type: 'task', label: 'Fulfill order' },
      reject: { type: 'task', label: 'Reject order' },
      end_ok: { type: 'end-event', label: 'Complete' },
      end_fail: { type: 'end-event', label: 'Rejected' },
    },
    flows: [
      { from: 'start', to: 'review', label: null },
      { from: 'review', to: 'decision', label: null },
      { from: 'decision', to: 'fulfill', label: 'Yes' },
      { from: 'decision', to: 'reject', label: 'No' },
      { from: 'fulfill', to: 'end_ok', label: null },
      { from: 'reject', to: 'end_fail', label: null },
    ],
  };

  it('starts with flowchart LR', () => {
    const output = processToMermaid(sampleProcess);
    expect(output.startsWith('flowchart LR\n')).toBe(true);
  });

  it('renders nodes with correct shapes', () => {
    const output = processToMermaid(sampleProcess);
    // Start event = double parens
    expect(output).toContain('start(("Order received"))');
    // Task = square brackets
    expect(output).toContain('review["Review order"]');
    // Gateway = curly braces
    expect(output).toContain('decision{"Approved?"}');
    // End event = double parens
    expect(output).toContain('end_ok(("Complete"))');
  });

  it('renders flows with labels', () => {
    const output = processToMermaid(sampleProcess);
    expect(output).toContain('decision -->|"Yes"| fulfill');
    expect(output).toContain('decision -->|"No"| reject');
  });

  it('renders flows without labels', () => {
    const output = processToMermaid(sampleProcess);
    expect(output).toContain('start --> review');
  });

  it('produces sorted deterministic output', () => {
    const a = processToMermaid(sampleProcess);
    const b = processToMermaid(sampleProcess);
    expect(a).toBe(b);
  });

  it('emits TAFKA-themed classDefs and class directives for each node kind', () => {
    const output = processToMermaid(sampleProcess);
    expect(output).toContain('classDef startEvent fill:#10B981');
    expect(output).toContain('classDef endEvent fill:#EF4444');
    expect(output).toContain('classDef gateway fill:#F59E0B');
    expect(output).toContain('classDef task fill:#FFFFFF');
    expect(output).toContain('class start startEvent');
    expect(output).toContain('class end_fail,end_ok endEvent');
    expect(output).toContain('class decision gateway');
    // Tasks are listed in sorted order: fulfill, reject, review
    expect(output).toMatch(/class fulfill,reject,review task/);
  });

  it('wraps the body in %%{init}%% when theme option is provided', () => {
    const output = processToMermaid(sampleProcess, { theme: 'dark' });
    expect(output.startsWith('%%{init:')).toBe(true);
    expect(output).toContain('"theme": "base"');
    expect(output).toContain('"background":"#0B0E14"');
    // Original body still present after the init line
    expect(output).toContain('flowchart LR');
  });

  it('emits status classDefs + class directives when any node has status', () => {
    const withStatus: Process = {
      ...sampleProcess,
      nodes: {
        ...sampleProcess.nodes,
        review: { type: 'task', label: 'Review order', status: 'blocked' },
        fulfill: { type: 'task', label: 'Fulfill order', status: 'done' },
      },
    };
    const output = processToMermaid(withStatus);
    // classDefs are emitted only when used — blocked + done here
    expect(output).toContain('classDef statusBlocked');
    expect(output).toContain('classDef statusDone');
    expect(output).toContain('class review statusBlocked');
    expect(output).toContain('class fulfill statusDone');
    // The 'open' class should NOT be present (no open node)
    expect(output).not.toContain('classDef statusOpen');
  });

  it('does not emit status classDefs when no node has status', () => {
    const output = processToMermaid(sampleProcess);
    expect(output).not.toContain('classDef statusOpen');
    expect(output).not.toContain('classDef statusDone');
    expect(output).not.toContain('classDef statusBlocked');
  });

  it('escapes double-quotes in labels to prevent Mermaid-injection', () => {
    const injection: Process = {
      format: 'viso-bpmn-v1',
      nodes: {
        evil: { type: 'task', label: 'He said "hi"]: style evil fill:#f00' },
      },
      flows: [],
    };
    const output = processToMermaid(injection);
    // The label line must contain exactly the opening + closing `"` of
    // the `["..."]` wrapper, no embedded quotes. Count quotes on the
    // `evil[...]` line.
    const labelLine = output.split('\n').find((l) => l.includes('evil['))!;
    const quoteCount = (labelLine.match(/"/g) || []).length;
    expect(quoteCount).toBe(2);
    expect(output).toContain('#quot;');
  });

  it('escapes double-quotes in flow labels too', () => {
    const injection: Process = {
      format: 'viso-bpmn-v1',
      nodes: {
        a: { type: 'task', label: 'A' },
        b: { type: 'task', label: 'B' },
      },
      flows: [{ from: 'a', to: 'b', label: 'say "hi"' }],
    };
    const output = processToMermaid(injection);
    const flowLine = output.split('\n').find((l) => l.includes('-->|'))!;
    // The `-->|"..."|` wrapper needs exactly 2 quotes.
    const quoteCount = (flowLine.match(/"/g) || []).length;
    expect(quoteCount).toBe(2);
    expect(output).toContain('#quot;');
  });
});
