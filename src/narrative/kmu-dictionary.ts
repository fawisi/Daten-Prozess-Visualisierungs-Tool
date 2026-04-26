import kmuJson from './kmu-entities.json';
import { normalizeLabel } from './shared.js';

export interface KmuEntity {
  kind: 'system' | 'external' | 'database' | 'cloud' | 'container';
  technology: string;
}

/**
 * KMU-entity dictionary (plan R5). Every known system/service is a
 * *distinct* label so Levenshtein-dedup never silently merges two real
 * entities that happen to be close in edit-distance (Shopify / Shopware
 * are 3 chars apart but different products). The dedup layer consults
 * `DISTINCT_SET` as a hard separator.
 */
const ENTRIES = (kmuJson as { entities: Record<string, KmuEntity> }).entities;

export const KMU_ENTITIES: ReadonlyMap<string, KmuEntity> = new Map(
  Object.entries(ENTRIES).map(([k, v]) => [k, v])
);

export const KMU_DISTINCT_SET: ReadonlySet<string> = new Set(KMU_ENTITIES.keys());

export function lookupKmu(label: string): KmuEntity | undefined {
  return KMU_ENTITIES.get(normalizeLabel(label));
}

/**
 * Build a regex that matches any KMU entity label as a whole word in
 * narrative text. Used by per-engine parsers to pre-identify
 * known entities before pattern-matching. Longest names first so
 * "SAP Business One" wins over "SAP".
 */
export function kmuLabelPattern(): RegExp {
  const keys = [...KMU_ENTITIES.keys()].sort((a, b) => b.length - a.length);
  const escaped = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // /u flag + \b-equivalent via lookarounds for Unicode-aware word
  // boundaries (plan R5 — \b is ASCII-only, can miss German umlauts).
  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}])(${escaped.join('|')})(?=[^\\p{L}\\p{N}]|$)`,
    'giu'
  );
}
