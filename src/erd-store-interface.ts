import type { Diagram } from './schema.js';

/**
 * Common contract for any backing store that serves MCP ERD tools.
 * Two implementations exist in v1.0:
 *   - DbmlStore   (src/dbml-store.ts) — `.dbml` files, canonical format
 *   - DiagramStore (src/store.ts)      — `.erd.json` files, legacy read path
 *                                        kept for `viso-mcp migrate`
 */
export interface ErdStore {
  /**
   * Absolute path of the source file. Consumers use this to derive
   * sidecar paths (positions, status, mode).
   */
  readonly filePath: string;
  load(): Promise<Diagram>;
  save(diagram: Diagram): Promise<void>;
}
