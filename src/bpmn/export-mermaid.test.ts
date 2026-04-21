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

  it('adds style classes for node types', () => {
    const output = processToMermaid(sampleProcess);
    expect(output).toContain('style start fill:#22C55E');
    expect(output).toContain('style end_fail,end_ok fill:#EF4444');
    expect(output).toContain('style decision fill:#F59E0B');
  });
});
