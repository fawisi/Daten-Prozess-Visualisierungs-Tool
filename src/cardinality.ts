import { z } from 'zod';
import type { RelationType_ } from './schema.js';

/**
 * Canonical relation cardinality. The persistent format is the
 * verbose long-form (one-to-one, one-to-many, many-to-one,
 * many-to-many) — this matches RelationType in src/schema.ts and
 * survives DBML round-trips.
 *
 * The short form (1:1, 1:N, N:1, N:N) is what consultants speak and
 * what the user-test report calls out as the missing surface form.
 * MA-3: tools that accept relation-types should accept BOTH forms via
 * `CardinalityInput` and normalise to the long form internally.
 */

export type Cardinality = RelationType_;

export const CARDINALITY_SHORT = ['1:1', '1:N', 'N:1', 'N:N'] as const;
export type CardinalityShort = (typeof CARDINALITY_SHORT)[number];

export const CardinalityLongSchema = z.enum([
  'one-to-one',
  'one-to-many',
  'many-to-one',
  'many-to-many',
]);

export const CardinalityShortSchema = z.enum(CARDINALITY_SHORT);

/** Accept either the long or the short form on tool inputs (MA-3). */
export const CardinalityInput = z.union([
  CardinalityLongSchema,
  CardinalityShortSchema,
]);

const SHORT_TO_LONG: Record<CardinalityShort, Cardinality> = {
  '1:1': 'one-to-one',
  '1:N': 'one-to-many',
  'N:1': 'many-to-one',
  'N:N': 'many-to-many',
};

const LONG_TO_SHORT: Record<Cardinality, CardinalityShort> = {
  'one-to-one': '1:1',
  'one-to-many': '1:N',
  'many-to-one': 'N:1',
  'many-to-many': 'N:N',
};

const LONG_TO_MERMAID: Record<Cardinality, string> = {
  'one-to-one': '||--||',
  'one-to-many': '||--o{',
  'many-to-one': '}o--||',
  'many-to-many': '}o--o{',
};

/** Normalise either form to the canonical long form. */
export function toLong(c: Cardinality | CardinalityShort): Cardinality {
  if (c in SHORT_TO_LONG) return SHORT_TO_LONG[c as CardinalityShort];
  return c as Cardinality;
}

/** Project the canonical form to the short form (for display/reports). */
export function toShort(c: Cardinality): CardinalityShort {
  return LONG_TO_SHORT[c];
}

/** Mermaid notation for a given cardinality. */
export function toMermaid(c: Cardinality): string {
  return LONG_TO_MERMAID[c];
}

/** Type-guard: is this a short-form literal? */
export function isShortForm(c: string): c is CardinalityShort {
  return (CARDINALITY_SHORT as readonly string[]).includes(c);
}
