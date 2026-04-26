import { describe, it, expect } from 'vitest';
import { isInitialAutoLayoutNeeded } from './auto-layout.js';

describe('isInitialAutoLayoutNeeded', () => {
  it('triggers when positions are empty and there is at least one node', () => {
    expect(isInitialAutoLayoutNeeded({}, 5)).toBe(true);
    expect(isInitialAutoLayoutNeeded({}, 1)).toBe(true);
  });

  it('skips when positions sidecar already has entries', () => {
    expect(isInitialAutoLayoutNeeded({ users: { x: 0, y: 0 } }, 5)).toBe(false);
  });

  it('skips when there are no nodes (empty diagram)', () => {
    expect(isInitialAutoLayoutNeeded({}, 0)).toBe(false);
  });

  it('skips when both positions and nodes are absent', () => {
    expect(isInitialAutoLayoutNeeded({}, 0)).toBe(false);
  });

  it('treats a single existing position as "sidecar present"', () => {
    expect(isInitialAutoLayoutNeeded({ a: { x: 1, y: 2 } }, 1)).toBe(false);
  });
});
