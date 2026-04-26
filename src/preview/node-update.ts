import type { Diagram } from '../schema.js';
import type { Landscape } from '../landscape/schema.js';
import type { NodeUpdate } from './components/shell/PropertiesPanel.js';

/**
 * Mutates an ERD table in-place with the fields from `update` and returns
 * the same `doc` for chaining. `description === ''` removes the property,
 * `status === null` clears the audit overlay, `undefined` leaves the field
 * untouched. Label updates are intentionally ignored here: an ERD table's
 * label IS its id, so renaming has to update every Relation that points
 * at it — that's a future-PR concern.
 *
 * The caller is expected to have JSON-parsed and Zod-validated `doc`
 * already; the extracted helper exists so the mutation step is unit-
 * testable without spinning up React Flow.
 */
export function applyErdTableUpdate(
  doc: Diagram,
  id: string,
  update: NodeUpdate
): Diagram {
  const table = doc.tables[id];
  if (!table) return doc;
  if (update.description !== undefined) {
    if (update.description === '') delete table.description;
    else table.description = update.description;
  }
  if (update.status !== undefined) {
    if (update.status === null) delete table.status;
    else table.status = update.status;
  }
  if (update.columns !== undefined) {
    // Full replacement: caller sends the entire desired array. Empty
    // arrays would violate the schema's `min(1)` rule, but we forward
    // the bad shape to the server intentionally — the user sees a 400
    // rather than the panel silently swallowing the invalid edit.
    table.columns = update.columns;
  }
  return doc;
}

/**
 * Landscape counterpart to {@link applyErdTableUpdate}. Landscape nodes
 * carry their own `label` distinct from the id, so unlike ERD tables the
 * label is freely mutable here.
 */
export function applyLandscapeNodeUpdate(
  doc: Landscape,
  id: string,
  update: NodeUpdate
): Landscape {
  const node = doc.nodes[id];
  if (!node) return doc;
  if (update.label !== undefined) node.label = update.label;
  if (update.description !== undefined) {
    if (update.description === '') delete node.description;
    else node.description = update.description;
  }
  if (update.status !== undefined) {
    if (update.status === null) delete node.status;
    else node.status = update.status;
  }
  return doc;
}
