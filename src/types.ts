import { z } from 'zod';

/**
 * Single Source of Truth fuer Diagramm-Typen.
 *
 * Wurde im Stabilization-Sprint v1.1.1 zentralisiert (Plan AD-1).
 * Vorher: lokal in bundle/manifest.ts:18 als inline-`z.enum`. UI-Komponenten
 * (CommandPalette, ToolPalette, AppSidebar, DiagramTabs) hatten unabhaengige
 * Unions — das fuehrte zu CR-3 (Landscape UI-vollkommen unzugaenglich, 5 Layer).
 *
 * Alle UI- und Tool-Code-Stellen importieren von hier, damit der TypeScript-
 * Compiler discriminated-union-Vollstaendigkeit ueber alle 3 Use Cases
 * (ERD / BPMN / Landscape) erzwingt.
 */
export const DiagramTypeEnum = z.enum(['erd', 'bpmn', 'landscape']);

/** `'erd' | 'bpmn' | 'landscape'`. */
export type DiagramType = z.infer<typeof DiagramTypeEnum>;

/**
 * UI-Tool-Identifier. Erweitert in v1.1.1 um ERD- und Landscape-Shapes
 * (CR-2 + CR-3).
 *
 * Shortcuts:
 * - V → pointer
 * - H → pan
 * - 1-4 → BPMN (start/end/task/gateway)
 * - 5 → ERD (table)
 * - 6-9 + 0 → Landscape (person/system/external/container/database)
 */
export type Tool =
  | 'pointer'
  | 'pan'
  // BPMN-Shapes
  | 'start-event'
  | 'end-event'
  | 'task'
  | 'gateway'
  // ERD-Shapes
  | 'table'
  // Landscape-Shapes (kind-Mapping siehe LandscapeSchema)
  | 'lc-person'
  | 'lc-system'
  | 'lc-external'
  | 'lc-container'
  | 'lc-database';
