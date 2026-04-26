import { describe, it, expect } from 'vitest';
import { inferProcessMode, bpmnOnlyNodeIds } from './mode-heuristic.js';
import { emptyProcess } from './schema.js';
import type { Process } from './schema.js';

describe('inferProcessMode', () => {
  it('returns "simple" for an empty process', () => {
    expect(inferProcessMode(emptyProcess())).toBe('simple');
  });

  it('returns "simple" for a v1.0 process with only simple-mode elements', () => {
    const process: Process = {
      format: 'viso-bpmn-v1',
      nodes: {
        start: { type: 'start-event', label: 'Start' },
        task1: { type: 'task', label: 'Do the thing' },
        gw: { type: 'gateway', label: 'Decision?', gatewayType: 'exclusive' },
        end1: { type: 'end-event', label: 'Done' },
      },
      flows: [],
    };
    expect(inferProcessMode(process)).toBe('simple');
  });

  it('returns a list of BPMN-only node IDs (currently empty for v1.0 schema)', () => {
    const process: Process = {
      format: 'viso-bpmn-v1',
      nodes: {
        gw: { type: 'gateway', label: '?', gatewayType: 'exclusive' },
      },
      flows: [],
    };
    // exclusive is simple-mode-safe; no IDs to hide.
    expect(bpmnOnlyNodeIds(process)).toEqual([]);
  });
});
