import { distance as levenshtein } from 'fastest-levenshtein';

/**
 * Narrative-parser primitives shared across the three per-engine
 * parsers (src/landscape/parse-description, src/bpmn/parse-description,
 * src/parse-description). Plan R5 / R8 — per-engine patterns, primitives
 * centralised here.
 *
 * Rules (plan R5):
 * - Unicode: `.normalize('NFC')` before any regex so `ö` (U+00F6) and
 *   `o` + combining diaeresis (U+006F U+0308) both parse.
 * - Layered dedup — exact → Levenshtein ≤ 2 → trigram-Jaccard 15%
 *   length-normalised → hard-separator on dictionary hits.
 * - Input cap 20 000 chars + trigram pre-filter avoid Levenshtein's
 *   O(n²) cliff at ≥ 200 candidates.
 */

export const MAX_NARRATIVE_INPUT_CHARS = 20_000;
export const LEVENSHTEIN_EXACT_MAX = 2;
export const LEVENSHTEIN_LENGTH_RATIO = 0.15;

/** Normalise text before parsing so Unicode comparisons behave. */
export function normalizeText(text: string): string {
  if (typeof text !== 'string') return '';
  return text.normalize('NFC').trim();
}

/**
 * Normalise an entity-candidate label for dedup:
 * - NFC
 * - lowercase (locale-aware via `toLocaleLowerCase`)
 * - strip trailing ` GmbH`, ` AG`, ` GbR`, ` Ltd`, ` Inc.` etc.
 * - strip common domain suffixes (`.com`, `.de`, `.io`)
 * - collapse whitespace
 */
const COMPANY_SUFFIXES = [
  /\s+(gmbh|ag|gbr|kg|ohg|e\.v\.|se)\.?\s*$/i,
  /\s+(ltd|llc|inc|corp|plc|sa|nv|bv)\.?\s*$/i,
];
const DOMAIN_SUFFIX = /\.(com|de|io|net|org|app|ai|co)$/i;

export function normalizeLabel(raw: string): string {
  let s = normalizeText(raw).toLocaleLowerCase('de');
  for (const re of COMPANY_SUFFIXES) s = s.replace(re, '');
  s = s.replace(DOMAIN_SUFFIX, '');
  return s.replace(/\s+/g, ' ').trim();
}

/** Build character-trigrams with a leading+trailing space marker. */
export function trigramsOf(raw: string): Set<string> {
  const padded = ` ${raw} `;
  const out = new Set<string>();
  for (let i = 0; i <= padded.length - 3; i += 1) {
    out.add(padded.slice(i, i + 3));
  }
  return out;
}

/** Jaccard similarity on trigram sets — fast O(n) pre-filter. */
export function trigramJaccard(a: string, b: string): number {
  const sa = trigramsOf(a);
  const sb = trigramsOf(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Layered dedup decision: should `a` and `b` be merged into the same
 * entity? Rules in priority order:
 *
 * 1. Dictionary hits — if either side is a known KMU-entity distinct
 *    from the other (Shopify vs Shopware), **never merge**.
 * 2. Exact after normalisation → merge.
 * 3. Levenshtein ≤ 2 for strings of length ≥ 5 → merge.
 * 4. Normalised length-ratio ≤ 15 % AND Jaccard ≥ 0.7 → merge.
 */
export interface DedupContext {
  /** Labels known to be *distinct* entities (e.g. KMU dictionary). */
  distinctSet?: Set<string>;
}

export function isDuplicateLabel(
  a: string,
  b: string,
  ctx: DedupContext = {}
): boolean {
  const na = normalizeLabel(a);
  const nb = normalizeLabel(b);
  if (na === '' || nb === '') return false;
  if (ctx.distinctSet && ctx.distinctSet.has(na) && ctx.distinctSet.has(nb) && na !== nb) {
    return false;
  }
  if (na === nb) return true;

  if (na.length >= 5 && nb.length >= 5) {
    const d = levenshtein(na, nb);
    if (d <= LEVENSHTEIN_EXACT_MAX) return true;
  }

  const minLen = Math.min(na.length, nb.length);
  if (minLen >= 6) {
    const d = levenshtein(na, nb);
    const ratio = d / Math.max(na.length, nb.length);
    if (ratio <= LEVENSHTEIN_LENGTH_RATIO && trigramJaccard(na, nb) >= 0.7) {
      return true;
    }
  }

  return false;
}

/**
 * Given a candidate label and an existing pool, return the matching
 * pool key to merge into (if any). Falls back to returning `null` for a
 * new entity.
 */
export function findDuplicate(
  candidate: string,
  existing: Iterable<string>,
  ctx: DedupContext = {}
): string | null {
  for (const key of existing) {
    if (isDuplicateLabel(candidate, key, ctx)) return key;
  }
  return null;
}

/** Safe identifier from a human label — A-Z0-9 + underscore, max 64 chars. */
export function labelToId(label: string, existing: Set<string>): string {
  const base = normalizeText(label)
    .replace(/[^A-Za-z0-9äöüÄÖÜß]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .slice(0, 64) || 'node';
  const safeBase = /^[a-zA-Z_]/.test(base) ? base : `n_${base}`;
  if (!existing.has(safeBase)) return safeBase;
  let i = 2;
  while (existing.has(`${safeBase}_${i}`)) i += 1;
  return `${safeBase}_${i}`;
}
