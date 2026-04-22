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
});
