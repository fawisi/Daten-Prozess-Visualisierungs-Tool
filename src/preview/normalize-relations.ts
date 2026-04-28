import { toLong, isShortForm } from '../cardinality.js';
import type { RelationType_ } from '../schema.js';

/**
 * Pre-Zod normalisation of legacy ERD-relation shapes. v1.0 files
 * (and Notion-pipeline outputs from before the v1.1 schema-tightening)
 * persist relations as `{ from: <table>, fromColumn, to: <table>,
 * toColumn, cardinality: 'N:1' }`. The canonical v1.1+ shape is
 * `{ from: { table, column }, to: { table, column }, type:
 * 'many-to-one' }` enforced by `RelationSchema` in src/schema.ts.
 *
 * Without this step, opening a legacy file in the editor passes the
 * permissive `loadSchema` reader (it only touches `rel.from.table`,
 * which is `undefined` on a string `from` — edges silently disappear)
 * but then any panel-driven write through `handleUpdateNode` aborts in
 * `DiagramSchema.safeParse` and the user sees their edit no-op. The
 * normalisation rewrites the in-memory doc once on read so the
 * subsequent `putSource` writes the canonical shape back to disk —
 * the file is migrated opportunistically the first time the user
 * touches a table.
 *
 * Mutates `doc.relations` in place and returns the same object so
 * callers can chain it inline. Unknown shapes pass through untouched
 * so genuinely-broken files still trip Zod at the next gate.
 */
export function normalizeRelations<T extends { relations?: unknown }>(doc: T): T {
  if (!doc || typeof doc !== 'object') return doc;
  const rels = (doc as { relations?: unknown }).relations;
  if (!Array.isArray(rels)) return doc;

  for (let i = 0; i < rels.length; i += 1) {
    const r = rels[i] as Record<string, unknown>;
    if (!r || typeof r !== 'object') continue;

    const fromIsString = typeof r.from === 'string';
    const toIsString = typeof r.to === 'string';
    const hasLegacyCols = 'fromColumn' in r || 'toColumn' in r;
    const hasCardinality = 'cardinality' in r && !('type' in r);

    if (!fromIsString && !toIsString && !hasLegacyCols && !hasCardinality) continue;

    if (fromIsString || hasLegacyCols) {
      const fromTable = fromIsString ? (r.from as string) : (r.from as { table?: string })?.table;
      const fromColumn =
        (r.fromColumn as string | undefined) ??
        (r.from as { column?: string } | undefined)?.column;
      if (fromTable && fromColumn) {
        r.from = { table: fromTable, column: fromColumn };
      }
    }
    if (toIsString || hasLegacyCols) {
      const toTable = toIsString ? (r.to as string) : (r.to as { table?: string })?.table;
      const toColumn =
        (r.toColumn as string | undefined) ??
        (r.to as { column?: string } | undefined)?.column;
      if (toTable && toColumn) {
        r.to = { table: toTable, column: toColumn };
      }
    }
    delete r.fromColumn;
    delete r.toColumn;

    if (hasCardinality) {
      const c = r.cardinality;
      if (typeof c === 'string') {
        if (isShortForm(c)) {
          r.type = toLong(c) as RelationType_;
        } else if (
          c === 'one-to-one' ||
          c === 'one-to-many' ||
          c === 'many-to-one' ||
          c === 'many-to-many'
        ) {
          r.type = c;
        }
      }
      delete r.cardinality;
    }
  }
  return doc;
}
