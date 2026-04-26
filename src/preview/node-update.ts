import { SafeIdentifier, type Diagram } from '../schema.js';
import type { Landscape } from '../landscape/schema.js';
import type { NodeUpdate } from './components/shell/PropertiesPanel.js';

/**
 * Mutates an ERD table in-place with the fields from `update` and returns
 * the same `doc` for chaining. `description === ''` removes the property,
 * `status === null` clears the audit overlay, `undefined` leaves the field
 * untouched.
 *
 * Label updates rename the table key and rewrite every relation that
 * points at the old key. The rename is a silent no-op when the new label
 * equals the current id, fails SafeIdentifier validation, or collides
 * with an existing table — the panel then keeps showing the old name
 * rather than appearing to "lose" the edit.
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
  if (
    update.label !== undefined &&
    update.label !== id &&
    SafeIdentifier.safeParse(update.label).success &&
    doc.tables[update.label] === undefined
  ) {
    const newKey = update.label;
    doc.tables[newKey] = table;
    delete doc.tables[id];
    for (const relation of doc.relations) {
      if (relation.from.table === id) relation.from.table = newKey;
      if (relation.to.table === id) relation.to.table = newKey;
    }
  }
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
