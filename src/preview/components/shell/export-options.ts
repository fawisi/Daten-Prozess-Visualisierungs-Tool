import type { DiagramType } from '../../../types.js';
import type { ExportFormat } from './TopHeader.js';

/**
 * Single source of truth for export-format metadata. Both the header
 * dropdown and the Cmd+K command palette read from here so a new
 * format only needs to be added once. (CR-7 user-test finding: header
 * showed 6 options, palette showed 3 — divergence already happened.)
 */
export interface ExportOption {
  id: ExportFormat;
  hint: string;
  /**
   * Diagram-types this format applies to. `'any'` shows for all three.
   * Omit to default to `'any'`.
   */
  when?: DiagramType | 'any';
}

export const EXPORT_OPTIONS: ExportOption[] = [
  { id: 'bundle', hint: '.zip', when: 'any' },
  { id: 'mermaid', hint: '.md', when: 'any' },
  { id: 'sql', hint: '.sql', when: 'erd' },
  { id: 'dbml', hint: '.dbml', when: 'erd' },
  { id: 'svg', hint: '.svg', when: 'any' },
  { id: 'png', hint: '.png', when: 'any' },
];

/** Filter export options for a given diagram type (or all when null). */
export function filterExportOptions(
  diagramType: DiagramType | null
): ExportOption[] {
  if (diagramType === null) return EXPORT_OPTIONS.filter((o) => o.when === 'any');
  return EXPORT_OPTIONS.filter((o) => !o.when || o.when === 'any' || o.when === diagramType);
}
