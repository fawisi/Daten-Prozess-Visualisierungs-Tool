/**
 * Returns true when an editor sync hook should auto-save the ELK layout
 * once on initial load. Pre-condition: the positions sidecar is empty
 * AND there is at least one node to place. Used by useDiagramSync /
 * useProcessSync / useLandscapeSync (MA-9 — v1.1.2).
 *
 * The motivation: without this, ELK lays out an unsaved diagram every
 * load. As soon as the user drags one node, the sidecar gets just that
 * one position and the rest of the canvas shifts on the next reload.
 * Persisting the initial ELK arrangement locks in a stable starting
 * point the user can iterate against.
 */
export function isInitialAutoLayoutNeeded(
  positions: Record<string, unknown>,
  nodeCount: number
): boolean {
  return Object.keys(positions).length === 0 && nodeCount > 0;
}
