import type { Process } from './schema.js';

/**
 * Heuristic for picking the right mode when a file is loaded without a
 * `.bpmn.mode.json` sidecar. Written to be extended as v1.1+ adds more
 * BPMN-2.0-only element kinds (inclusive/parallel gateways, timer events,
 * subprocesses).
 *
 * Current rules (plan Phase-P1 resolved-gap #1):
 * - Newly created, empty file          → 'simple'
 * - Sidecar present                    → sidecar.mode (handled outside)
 * - Sidecar missing, any BPMN-only elt → 'bpmn'   (compat for v1.0 files)
 * - Sidecar missing, no BPMN-only elt  → 'simple'
 *
 * The v1.0 process schema only has `exclusive` gateways and the four
 * basic node kinds, so today no element triggers the BPMN-branch. The
 * function is still wired so v1.2+ additions (timer, inclusive, etc.)
 * only need to extend `BPMN_ONLY_GATEWAY_KINDS` / add a check, not
 * rewire the load path.
 */
export type ProcessMode = 'simple' | 'bpmn';

/** Gateway sub-kinds that are BPMN-2.0-only (not representable in simple mode). */
const BPMN_ONLY_GATEWAY_KINDS = new Set<string>([
  // 'inclusive', 'parallel', 'event-based' — add here once the schema grows
]);

export function inferProcessMode(process: Process): ProcessMode {
  const nodes = Object.values(process.nodes);
  if (nodes.length === 0) return 'simple';
  for (const node of nodes) {
    if (node.type === 'gateway' && node.gatewayType && BPMN_ONLY_GATEWAY_KINDS.has(node.gatewayType)) {
      return 'bpmn';
    }
  }
  return 'simple';
}

/** Return the BPMN-only node IDs so UI can count them for the hidden-elements pill. */
export function bpmnOnlyNodeIds(process: Process): string[] {
  const ids: string[] = [];
  for (const [id, node] of Object.entries(process.nodes)) {
    if (node.type === 'gateway' && node.gatewayType && BPMN_ONLY_GATEWAY_KINDS.has(node.gatewayType)) {
      ids.push(id);
    }
  }
  return ids;
}
