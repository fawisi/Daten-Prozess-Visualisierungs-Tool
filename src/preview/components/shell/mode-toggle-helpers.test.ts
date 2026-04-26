import { describe, it, expect } from 'vitest';
import { pickModeKind, shouldShowModeToggle } from './mode-toggle-helpers.js';

describe('pickModeKind', () => {
  it('returns landscape for a landscape diagram', () => {
    expect(pickModeKind('landscape')).toBe('landscape');
  });

  it('returns process for a BPMN diagram', () => {
    expect(pickModeKind('bpmn')).toBe('process');
  });

  it('returns process for an ERD diagram (toggle is hidden anyway)', () => {
    expect(pickModeKind('erd')).toBe('process');
  });

  it('returns process when no diagram is loaded', () => {
    expect(pickModeKind(null)).toBe('process');
  });
});

describe('shouldShowModeToggle', () => {
  it('shows the toggle for BPMN', () => {
    expect(shouldShowModeToggle('bpmn')).toBe(true);
  });

  it('shows the toggle for landscape (MA-10)', () => {
    expect(shouldShowModeToggle('landscape')).toBe(true);
  });

  it('hides the toggle for ERD', () => {
    expect(shouldShowModeToggle('erd')).toBe(false);
  });

  it('hides the toggle for null (no file open)', () => {
    expect(shouldShowModeToggle(null)).toBe(false);
  });
});
