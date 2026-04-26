import type { DiagramType } from '../../../types.js';
import type { ModeToggleKind } from './TopHeader.js';

/**
 * Decides which two-state toggle the header renders for a given active
 * diagram. Landscape gets its own L1/L2 toggle (MA-10 — v1.1.2);
 * everything else falls back to the BPMN simple/full process toggle so
 * existing call-sites that don't pass `modeKind` keep working.
 */
export function pickModeKind(diagramType: DiagramType | null): ModeToggleKind {
  return diagramType === 'landscape' ? 'landscape' : 'process';
}

/**
 * Whether the header renders a mode-toggle at all. ERD and the empty
 * "no file open" state get no toggle — there's no second view-mode for
 * a flat schema.
 */
export function shouldShowModeToggle(diagramType: DiagramType | null): boolean {
  return diagramType === 'bpmn' || diagramType === 'landscape';
}
