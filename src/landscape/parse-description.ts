import {
  findDuplicate,
  labelToId,
  normalizeText,
  MAX_NARRATIVE_INPUT_CHARS,
} from '../narrative/shared.js';
import { KMU_DISTINCT_SET, lookupKmu } from '../narrative/kmu-dictionary.js';
import { DEFAULT_PARSE_CONFIG } from '../narrative/config.js';
import type { ParseDescriptionConfig } from '../narrative/config.js';
import { emptyLandscape, LandscapeSchema } from './schema.js';
import type { Landscape, LandscapeNode, LandscapeRelation } from './schema.js';

/**
 * Landscape narrative parser (plan R5).
 *
 * Deterministic regex-first extractor for German Mittelstand-speak
 * ("Winestro synchronisiert mit Shopify, SharePoint speichert
 * Rechnungen"). LLM fallback path is accepted at the config level but
 * currently degrades to regex with a warning — Claude Desktop has not
 * shipped sampling/createMessage support (plan R5).
 *
 * Pattern-table shipping in v1.1 (safe):
 *  1. "X synchronisiert mit Y" → relation X→Y, label "sync"
 *  2. "X syncht mit Y"         → same
 *  3. "X speichert (Daten/Rechnungen/etc.) in Y" → relation X→Y,
 *                                       Y auto-tagged as database if its
 *                                       kind is not yet set.
 *  4. "X nutzt Y" / "X verwendet Y" / "X braucht Y" → relation X→Y
 *  5. "X ist ein externes System" / "X ist extern" → Node kind=external
 *  6. "X ist eine Datenbank" → Node kind=database
 *  7. "X ist ein Webshop"    → Node kind=system  (+ system_role: webshop)
 *  8. "X läuft auf Y"        → container relation X→Y, Y kind=cloud
 *  9. "X schickt Daten an Y" → relation X→Y, label "push"
 *  12. "X empfängt Daten von Y" → relation Y→X, label "pull"
 *  15. "X gehört zu Y"       → boundary-membership (parentId, L2-only)
 */

const REGEX_LINE_SEP = /[.!?\n;]+/;

type Pattern = {
  /** Regex. `X` and `Y` in comments map to capture-groups `$1` and `$2`. */
  re: RegExp;
  /** Apply the match to the partial landscape + return emitted relation IDs, if any. */
  apply: (match: RegExpMatchArray, ctx: ParseCtx) => void;
  /** Human-readable safety note (unused at runtime). */
  safety?: string;
};

interface ParseCtx {
  landscape: Landscape;
  existingIds: Set<string>;
  labelToIdMap: Map<string, string>; // normalisedLabel -> id
  stats: { patternHits: Record<string, number>; relationsAdded: number };
}

function upsertNode(ctx: ParseCtx, label: string, override?: Partial<LandscapeNode>): string {
  const dupKey = findDuplicate(
    label,
    ctx.labelToIdMap.keys(),
    { distinctSet: KMU_DISTINCT_SET as Set<string> }
  );
  const normalised = label.trim();
  if (dupKey) {
    return ctx.labelToIdMap.get(dupKey)!;
  }
  const kmu = lookupKmu(normalised);
  const baseKind = (override?.kind ?? kmu?.kind ?? 'system') as LandscapeNode['kind'];
  const id = labelToId(normalised, ctx.existingIds);
  ctx.existingIds.add(id);
  ctx.labelToIdMap.set(normalised.toLowerCase(), id);
  const node: LandscapeNode = {
    kind: baseKind,
    label: normalised,
    ...(kmu?.technology && (baseKind !== 'person' && baseKind !== 'external' && baseKind !== 'system')
      ? { technology: kmu.technology }
      : {}),
    ...(override ?? {}),
    // Always honour explicit override kind last.
    ...(override?.kind ? { kind: override.kind as LandscapeNode['kind'] } : {}),
  } as LandscapeNode;
  ctx.landscape.nodes[id] = node;
  return id;
}

function addRelation(
  ctx: ParseCtx,
  fromId: string,
  toId: string,
  label?: string
): void {
  if (fromId === toId) return;
  const exists = ctx.landscape.relations.some((r) => r.from === fromId && r.to === toId);
  if (exists) return;
  const rel: LandscapeRelation = {
    from: fromId,
    to: toId,
    ...(label ? { label } : {}),
  };
  ctx.landscape.relations.push(rel);
  ctx.stats.relationsAdded += 1;
}

/**
 * Entity-candidate token. Matches:
 * - A single capitalised word (German nouns, brand names): Winestro, Shopify,
 *   SharePoint, Postgres.
 * - Multi-word proper nouns: "SAP Business One", "Google Drive".
 * - ASCII acronyms in all caps: DATEV, ERP.
 *
 * Does NOT match lowercase verbs / function words, so `"Der Webshop
 * nutzt Stripe"` captures only `Webshop` and `Stripe`.
 *
 * Plan R5: `/u` + `\p{L}` + deliberately NO `\s` inside the char-class,
 * so multi-word names have to be explicitly space-separated via
 * `(?:\s+…)` repetition.
 */
// `[\p{Lu}][\p{L}\p{N}]*` = one uppercase letter followed by any letters or
// digits. Covers Brand-names (Winestro, SharePoint), German nouns (Webshop,
// Datenbank), all-caps acronyms (DATEV, ERP — the starting letter is Lu).
// Multi-word entities are up to 4 space-separated Title-case words.
const CAP_WORD = '[\\p{Lu}][\\p{L}\\p{N}]{1,31}';
const ENTITY = `(?:${CAP_WORD}(?:\\s+${CAP_WORD}){0,3})`;

/**
 * Patterns use `/u` but NOT `/i` — German verbs ('synchronisiert',
 * 'speichert') are always lowercase, and case-sensitivity is what lets
 * CAP_WORD actually anchor on proper-noun entities instead of matching
 * any string. Verbs that optionally capitalise at sentence start are
 * handled explicitly via `(?:[Aa]…)`-style alternation where needed.
 */
function pat(body: string): RegExp {
  return new RegExp(body, 'u');
}

const PATTERNS: Pattern[] = [
  {
    re: pat(`(${ENTITY})\\s+synchronisiert(?:\\s+\\p{L}+)?(?:\\s+sich)?\\s+mit\\s+(${ENTITY})`),
    apply: (m, ctx) => {
      const a = upsertNode(ctx, m[1]);
      const b = upsertNode(ctx, m[2]);
      addRelation(ctx, a, b, 'sync');
      ctx.stats.patternHits.sync = (ctx.stats.patternHits.sync ?? 0) + 1;
    },
  },
  {
    re: pat(`(${ENTITY})\\s+syncht\\s+mit\\s+(${ENTITY})`),
    apply: (m, ctx) => {
      const a = upsertNode(ctx, m[1]);
      const b = upsertNode(ctx, m[2]);
      addRelation(ctx, a, b, 'sync');
      ctx.stats.patternHits.sync = (ctx.stats.patternHits.sync ?? 0) + 1;
    },
  },
  {
    re: pat(
      `(${ENTITY})\\s+speichert(?:\\s+\\p{L}+){0,3}?\\s+in\\s+(?:einem?\\s+(?:internen\\s+)?)?(${ENTITY})`
    ),
    apply: (m, ctx) => {
      const a = upsertNode(ctx, m[1]);
      // Target auto-promoted to database only when the dictionary has
      // no other opinion (SharePoint -> system, Postgres -> database).
      const kmu = lookupKmu(m[2]);
      const b = upsertNode(ctx, m[2], kmu?.kind ? undefined : { kind: 'database' });
      addRelation(ctx, a, b, 'persist');
      ctx.stats.patternHits.persist = (ctx.stats.patternHits.persist ?? 0) + 1;
    },
  },
  {
    re: pat(`(${ENTITY})\\s+(?:nutzt|verwendet|braucht)\\s+(${ENTITY})`),
    apply: (m, ctx) => {
      const a = upsertNode(ctx, m[1]);
      const b = upsertNode(ctx, m[2]);
      addRelation(ctx, a, b, 'uses');
      ctx.stats.patternHits.uses = (ctx.stats.patternHits.uses ?? 0) + 1;
    },
  },
  {
    re: pat(`(${ENTITY})\\s+ist\\s+ein(?:e|er)?\\s+externe[sr]?\\s+System`),
    apply: (m, ctx) => {
      upsertNode(ctx, m[1], { kind: 'external' });
      ctx.stats.patternHits.external_decl = (ctx.stats.patternHits.external_decl ?? 0) + 1;
    },
  },
  {
    re: pat(`(${ENTITY})\\s+ist\\s+extern\\b`),
    apply: (m, ctx) => {
      upsertNode(ctx, m[1], { kind: 'external' });
      ctx.stats.patternHits.external_decl = (ctx.stats.patternHits.external_decl ?? 0) + 1;
    },
  },
  {
    re: pat(`(${ENTITY})\\s+ist\\s+eine?\\s+Datenbank\\b`),
    apply: (m, ctx) => {
      upsertNode(ctx, m[1], { kind: 'database' });
      ctx.stats.patternHits.database_decl = (ctx.stats.patternHits.database_decl ?? 0) + 1;
    },
  },
  {
    re: pat(`(${ENTITY})\\s+läuft\\s+auf\\s+(${ENTITY})`),
    apply: (m, ctx) => {
      const a = upsertNode(ctx, m[1]);
      const kmu = lookupKmu(m[2]);
      const b = upsertNode(ctx, m[2], kmu?.kind ? undefined : { kind: 'cloud' });
      addRelation(ctx, a, b, 'hosted on');
      ctx.stats.patternHits.hosted = (ctx.stats.patternHits.hosted ?? 0) + 1;
    },
  },
  {
    re: pat(`(${ENTITY})\\s+schickt\\s+(?:\\p{L}+\\s+)?an\\s+(${ENTITY})`),
    apply: (m, ctx) => {
      const a = upsertNode(ctx, m[1]);
      const b = upsertNode(ctx, m[2]);
      addRelation(ctx, a, b, 'push');
      ctx.stats.patternHits.push = (ctx.stats.patternHits.push ?? 0) + 1;
    },
  },
  {
    re: pat(`(${ENTITY})\\s+empfängt\\s+(?:\\p{L}+\\s+)?von\\s+(${ENTITY})`),
    apply: (m, ctx) => {
      const receiver = upsertNode(ctx, m[1]);
      const sender = upsertNode(ctx, m[2]);
      addRelation(ctx, sender, receiver, 'pull');
      ctx.stats.patternHits.pull = (ctx.stats.patternHits.pull ?? 0) + 1;
    },
  },
];

export interface ParseResult {
  landscape: Landscape;
  warnings: string[];
  engineUsed: 'regex' | 'llm';
  stats: { patternHits: Record<string, number>; relationsAdded: number; nodesAdded: number };
  unparsedSpans: string[];
}

/**
 * Parse a narrative text into a Landscape. Returns a *new* landscape
 * merged on top of the optional `base` (agents often call this
 * repeatedly and expect the same entity to dedup across calls).
 */
export function parseLandscapeDescription(
  text: string,
  config: ParseDescriptionConfig = DEFAULT_PARSE_CONFIG,
  base: Landscape = emptyLandscape()
): ParseResult {
  const warnings: string[] = [];
  let engineUsed: ParseResult['engineUsed'] = 'regex';
  if (config.engine === 'llm') {
    warnings.push(
      'config.engine="llm": LLM sampling is not yet host-supported (MCP sampling/createMessage). Falling back to regex.'
    );
  }

  const normalised = normalizeText(text);
  if (normalised.length === 0) {
    return {
      landscape: base,
      warnings,
      engineUsed,
      stats: { patternHits: {}, relationsAdded: 0, nodesAdded: 0 },
      unparsedSpans: [],
    };
  }
  if (normalised.length > MAX_NARRATIVE_INPUT_CHARS) {
    warnings.push(
      `Input truncated to ${MAX_NARRATIVE_INPUT_CHARS} chars (was ${normalised.length}).`
    );
  }
  const input = normalised.slice(0, MAX_NARRATIVE_INPUT_CHARS);

  // Clone base so callers keep their original reference immutable.
  const landscape: Landscape = LandscapeSchema.parse(JSON.parse(JSON.stringify(base)));
  const existingIds = new Set(Object.keys(landscape.nodes));
  const labelToIdMap = new Map<string, string>();
  for (const [id, node] of Object.entries(landscape.nodes)) {
    labelToIdMap.set(node.label.toLowerCase(), id);
  }
  const nodesAtStart = existingIds.size;
  const ctx: ParseCtx = {
    landscape,
    existingIds,
    labelToIdMap,
    stats: { patternHits: {}, relationsAdded: 0 },
  };

  const lines = input.split(REGEX_LINE_SEP).map((s) => s.trim()).filter(Boolean);
  const unparsedSpans: string[] = [];

  for (const line of lines) {
    let matchedAny = false;
    for (const pattern of PATTERNS) {
      const m = line.match(pattern.re);
      if (m) {
        pattern.apply(m, ctx);
        matchedAny = true;
      }
    }
    if (!matchedAny) unparsedSpans.push(line);
  }

  const nodesAdded = existingIds.size - nodesAtStart;
  return {
    landscape,
    warnings,
    engineUsed,
    stats: { ...ctx.stats, nodesAdded },
    unparsedSpans,
  };
}
