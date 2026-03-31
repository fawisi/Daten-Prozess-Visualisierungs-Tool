import { describe, it, expect } from 'vitest';
import {
  NodeIdentifier,
  ProcessNodeSchema,
  FlowSchema,
  ProcessSchema,
  emptyProcess,
} from './schema.js';

describe('NodeIdentifier', () => {
  it('accepts valid identifiers', () => {
    expect(NodeIdentifier.safeParse('start').success).toBe(true);
    expect(NodeIdentifier.safeParse('my_node').success).toBe(true);
    expect(NodeIdentifier.safeParse('step-1').success).toBe(true);
    expect(NodeIdentifier.safeParse('_private').success).toBe(true);
  });

  it('rejects invalid identifiers', () => {
    expect(NodeIdentifier.safeParse('').success).toBe(false);
    expect(NodeIdentifier.safeParse('123start').success).toBe(false);
    expect(NodeIdentifier.safeParse('has space').success).toBe(false);
    expect(NodeIdentifier.safeParse('a'.repeat(65)).success).toBe(false);
  });
});

describe('ProcessNodeSchema', () => {
  it('validates a task node', () => {
    const result = ProcessNodeSchema.safeParse({
      type: 'task',
      label: 'Review document',
    });
    expect(result.success).toBe(true);
  });

  it('validates a gateway with gatewayType', () => {
    const result = ProcessNodeSchema.safeParse({
      type: 'gateway',
      label: 'Approved?',
      gatewayType: 'exclusive',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown node types', () => {
    const result = ProcessNodeSchema.safeParse({
      type: 'unknown',
      label: 'Bad',
    });
    expect(result.success).toBe(false);
  });
});

describe('FlowSchema', () => {
  it('validates a flow with label', () => {
    const result = FlowSchema.safeParse({
      from: 'start',
      to: 'task1',
      label: 'Yes',
    });
    expect(result.success).toBe(true);
  });

  it('validates a flow with null label', () => {
    const result = FlowSchema.safeParse({
      from: 'start',
      to: 'task1',
      label: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('ProcessSchema', () => {
  it('validates a complete process', () => {
    const result = ProcessSchema.safeParse({
      format: 'daten-viz-bpmn-v1',
      name: 'Test Process',
      nodes: {
        start: { type: 'start-event', label: 'Begin' },
        task1: { type: 'task', label: 'Do work' },
        end: { type: 'end-event', label: 'Done' },
      },
      flows: [
        { from: 'start', to: 'task1', label: null },
        { from: 'task1', to: 'end', label: null },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects wrong format', () => {
    const result = ProcessSchema.safeParse({
      format: 'daten-viz-erd-v1',
      nodes: {},
      flows: [],
    });
    expect(result.success).toBe(false);
  });

  it('emptyProcess creates valid schema', () => {
    const result = ProcessSchema.safeParse(emptyProcess());
    expect(result.success).toBe(true);
  });
});
