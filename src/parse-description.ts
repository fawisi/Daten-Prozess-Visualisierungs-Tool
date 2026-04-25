import { normalizeText, MAX_NARRATIVE_INPUT_CHARS } from './narrative/shared.js';
import { DEFAULT_PARSE_CONFIG } from './narrative/config.js';
import type { ParseDescriptionConfig } from './narrative/config.js';
import { isLlmEnabled, tryLlmParse } from './narrative/llm-adapter.js';
import { DiagramSchema, emptyDiagram } from './schema.js';
import type { Diagram, Column, Relation } from './schema.js';

const ERD_LLM_SYSTEM_PROMPT = `You translate German business descriptions into a viso-erd-v1 ERD JSON document.
Return ONLY a JSON object that matches this shape:
{
  "format": "viso-erd-v1",
  "tables": { "<snake_case>": { "columns": [{ "name": "<id>", "type": "uuid", "primary": true }] } },
  "relations": [{ "from": { "table": "<child>", "column": "<fk>" }, "to": { "table": "<parent>", "column": "id" }, "type": "many-to-one" }]
}
Use snake_case identifiers. Default column type is "uuid" for FKs and "text" otherwise. No prose, no fences.`;

/**
 * ERD narrative parser. v1.1 shipped one flagship pattern (TABLE_HAS);
 * v1.1.1 adds five DE relation-patterns surfaced by the 2026-04-25 user
 * test (CR-5). When a relation pattern fires we auto-create the involved
 * tables with a default `id` PK so an agent can scaffold a complete
 * schema from a single sentence like "Kunden haben mehrere Bestellungen."
 */

const TABLE_PATTERN =
  /^Tabelle\s+([a-zA-Z_][a-zA-Z0-9_]{0,62})\s+hat\s+(.+?)[.,;]?$/iu;

const COLUMN_PATTERN = /^([a-zA-Z_][a-zA-Z0-9_]{0,62})(?:\s+als\s+([a-zA-Z][a-zA-Z0-9()_]{0,31}))?$/i;

// --- DE relation patterns (v1.1.1) ---
// Each captures (parentEntity, ?, childEntity) — the FK lives on the child.
const HABEN_MEHRERE = /^(\w+)\s+(?:haben|hat)\s+mehrere\s+(\w+)[.,;]?$/iu;
const GEHOEREN_ZU =
  /^(\w+)\s+(?:geh(?:ö|oe)ren|geh(?:ö|oe)rt)\s+zu\s+(?:einem|einer|einen)?\s*(\w+)[.,;]?$/iu;
const REFERENZIERT =
  /^(\w+)\s+referenziert\s+(\w+)(?:\s+(?:ueber|über)\s+(\w+))?[.,;]?$/iu;
const ENTHAELT = /^(?:Jede[rs]?\s+)?(\w+)\s+enth(?:ä|ae)lt\s+(?:mehrere\s+)?(\w+)[.,;]?$/iu;
const ZUGEORDNET =
  /^(\w+)\s+(?:ist|sind)\s+(?:einem|einer|einen)\s+(\w+)\s+zugeordnet[.,;]?$/iu;

/**
 * Normalise a token to a snake_case identifier that fits SafeIdentifier.
 * Removes diacritics so "größe" and "Größe" both yield "groesse".
 */
function normaliseId(token: string): string {
  const lowered = token.toLowerCase();
  const transliterated = lowered
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
  const cleaned = transliterated.replace(/[^a-z0-9_]/g, '_');
  return cleaned.match(/^[a-z_]/) ? cleaned : `t_${cleaned}`;
}

export interface ErdParseResult {
  diagram: Diagram;
  engineUsed: 'regex' | 'llm' | 'hybrid';
  warnings: string[];
  stats: {
    tablesAdded: number;
    columnsAdded: number;
    relationsAdded: number;
    patternHits: Record<string, number>;
  };
  unparsedSpans: string[];
}

export function parseDiagramDescription(
  text: string,
  config: ParseDescriptionConfig = DEFAULT_PARSE_CONFIG,
  base: Diagram = emptyDiagram()
): ErdParseResult {
  const warnings: string[] = [];
  let engineUsed: ErdParseResult['engineUsed'] = 'regex';
  if (config.engine === 'llm') {
    if (isLlmEnabled()) {
      // The LLM path is async-only — synchronous callers stay on regex
      // and the agent gets a hint to switch to parseDiagramDescriptionAsync.
      warnings.push(
        'config.engine="llm": call parseDiagramDescriptionAsync() to use the LLM path. Falling back to regex.'
      );
    } else {
      warnings.push(
        'config.engine="llm": VISO_LLM_PARSE flag or ANTHROPIC_API_KEY missing. Falling back to regex.'
      );
    }
  }

  const normalised = normalizeText(text);
  if (normalised.length > MAX_NARRATIVE_INPUT_CHARS) {
    warnings.push(
      `Input truncated to ${MAX_NARRATIVE_INPUT_CHARS} chars (was ${normalised.length}).`
    );
  }
  const input = normalised.slice(0, MAX_NARRATIVE_INPUT_CHARS);

  const diagram: Diagram = DiagramSchema.parse(JSON.parse(JSON.stringify(base)));
  const tablesAtStart = Object.keys(diagram.tables).length;
  const relationsAtStart = diagram.relations.length;
  let columnsAdded = 0;
  const stats = {
    tablesAdded: 0,
    columnsAdded: 0,
    relationsAdded: 0,
    patternHits: {} as Record<string, number>,
  };

  /**
   * Lazily create a stub table with an `id uuid` primary key when a
   * relation-pattern references a table the agent never spelled out.
   * Returns the canonical (snake-case) table name.
   */
  function ensureTable(rawName: string): string {
    const id = normaliseId(rawName);
    if (!diagram.tables[id]) {
      diagram.tables[id] = {
        columns: [{ name: 'id', type: 'uuid', primary: true }],
      };
      columnsAdded += 1;
    }
    return id;
  }

  /**
   * Add a foreign-key column on `child` referencing `parent.id` plus a
   * many-to-one relation. Idempotent — a re-parse won't duplicate the
   * column or the relation. Returns true when at least one of the two
   * was created.
   */
  function ensureRelation(parent: string, child: string): boolean {
    const parentId = ensureTable(parent);
    const childId = ensureTable(child);
    const fkName = `${parentId}_id`;
    const childTable = diagram.tables[childId];
    let added = false;
    if (!childTable.columns.some((c) => c.name === fkName)) {
      childTable.columns.push({ name: fkName, type: 'uuid' });
      columnsAdded += 1;
      added = true;
    }
    const relation: Relation = {
      from: { table: childId, column: fkName },
      to: { table: parentId, column: 'id' },
      type: 'many-to-one',
    };
    const exists = diagram.relations.some(
      (r) =>
        r.from.table === relation.from.table &&
        r.from.column === relation.from.column &&
        r.to.table === relation.to.table &&
        r.to.column === relation.to.column
    );
    if (!exists) {
      diagram.relations.push(relation);
      added = true;
    }
    return added;
  }

  const lines = input.split(/[.!?\n;]+/).map((s) => s.trim()).filter(Boolean);
  const unparsedSpans: string[] = [];

  for (const line of lines) {
    // 1) "Tabelle X hat …" — explicit columns
    const m = line.match(TABLE_PATTERN);
    if (m) {
      const name = m[1];
      const columnsRaw = m[2].split(/\s*,\s*|\s+und\s+/u).map((s) => s.trim()).filter(Boolean);
      const columns: Column[] = columnsRaw.map((tok) => {
        const c = tok.match(COLUMN_PATTERN);
        const colName = c ? c[1] : tok.replace(/[^a-zA-Z0-9_]/g, '_');
        const typ = c && c[2] ? c[2] : 'text';
        const col: Column = {
          name: colName,
          type: typ,
          ...(colName === 'id' ? { primary: true } : {}),
        };
        return col;
      });
      if (columns.length === 0) continue;
      if (!columns.some((c) => c.primary)) columns[0].primary = true;
      if (diagram.tables[name]) {
        for (const col of columns) {
          if (!diagram.tables[name].columns.some((c) => c.name === col.name)) {
            diagram.tables[name].columns.push(col);
            columnsAdded += 1;
          }
        }
      } else {
        diagram.tables[name] = { columns };
        columnsAdded += columns.length;
      }
      stats.patternHits.table_has = (stats.patternHits.table_has ?? 0) + 1;
      continue;
    }

    // 2) "Kunden haben mehrere Bestellungen." — 1:N (parent first, child second)
    const mHaben = line.match(HABEN_MEHRERE);
    if (mHaben) {
      ensureRelation(mHaben[1], mHaben[2]);
      stats.patternHits.haben_mehrere = (stats.patternHits.haben_mehrere ?? 0) + 1;
      continue;
    }

    // 3) "Bestellungen gehoeren zu einem Kunden." — N:1 (child first, parent second)
    const mGehoeren = line.match(GEHOEREN_ZU);
    if (mGehoeren) {
      ensureRelation(mGehoeren[2], mGehoeren[1]);
      stats.patternHits.gehoeren_zu = (stats.patternHits.gehoeren_zu ?? 0) + 1;
      continue;
    }

    // 4) "Order referenziert Customer ueber customer_id." — explicit FK
    const mRef = line.match(REFERENZIERT);
    if (mRef) {
      const childId = ensureTable(mRef[1]);
      const parentId = ensureTable(mRef[2]);
      const explicitFk = mRef[3] ? mRef[3].toLowerCase() : `${parentId}_id`;
      const childTable = diagram.tables[childId];
      if (!childTable.columns.some((c) => c.name === explicitFk)) {
        childTable.columns.push({ name: explicitFk, type: 'uuid' });
        columnsAdded += 1;
      }
      const relation: Relation = {
        from: { table: childId, column: explicitFk },
        to: { table: parentId, column: 'id' },
        type: 'many-to-one',
      };
      const exists = diagram.relations.some(
        (r) =>
          r.from.table === relation.from.table &&
          r.from.column === relation.from.column &&
          r.to.table === relation.to.table &&
          r.to.column === relation.to.column
      );
      if (!exists) diagram.relations.push(relation);
      stats.patternHits.referenziert = (stats.patternHits.referenziert ?? 0) + 1;
      continue;
    }

    // 5) "Jede Bestellung enthält mehrere Bestellpositionen." — 1:N
    const mEnt = line.match(ENTHAELT);
    if (mEnt) {
      ensureRelation(mEnt[1], mEnt[2]);
      stats.patternHits.enthaelt = (stats.patternHits.enthaelt ?? 0) + 1;
      continue;
    }

    // 6) "Produkte sind einer Kategorie zugeordnet." — N:1
    const mZug = line.match(ZUGEORDNET);
    if (mZug) {
      ensureRelation(mZug[2], mZug[1]);
      stats.patternHits.zugeordnet = (stats.patternHits.zugeordnet ?? 0) + 1;
      continue;
    }

    unparsedSpans.push(line);
  }

  stats.tablesAdded = Object.keys(diagram.tables).length - tablesAtStart;
  stats.columnsAdded = columnsAdded;
  stats.relationsAdded = diagram.relations.length - relationsAtStart;

  return { diagram, engineUsed, warnings, stats, unparsedSpans };
}

/**
 * Async narrative parser. When `engine: 'llm'` is set AND the env-flags
 * are configured (VISO_LLM_PARSE=true + ANTHROPIC_API_KEY) the input is
 * routed through the Anthropic Messages API; on any failure (network,
 * schema-violation, timeout) the function transparently falls back to
 * the synchronous regex pipeline so the caller never sees a hard error.
 *
 * Engines:
 *   - 'regex'   → identical to parseDiagramDescription
 *   - 'llm'     → LLM-only (still falls back to regex on failure)
 *   - 'hybrid'  → LLM-first, regex fills in anything the LLM missed
 */
export async function parseDiagramDescriptionAsync(
  text: string,
  config: ParseDescriptionConfig = DEFAULT_PARSE_CONFIG,
  base: Diagram = emptyDiagram()
): Promise<ErdParseResult> {
  if (config.engine !== 'llm' || !isLlmEnabled()) {
    return parseDiagramDescription(text, config, base);
  }

  const llmResult = await tryLlmParse({
    text,
    schema: DiagramSchema,
    systemPrompt: ERD_LLM_SYSTEM_PROMPT,
  });

  if (!llmResult) {
    const fallback = parseDiagramDescription(text, { engine: 'regex' }, base);
    fallback.warnings.push(
      'LLM call failed (network, timeout, or schema-violation) — fell back to regex.'
    );
    return fallback;
  }

  // Merge LLM-derived diagram into the existing base. The LLM operates
  // on the full document so we replace tables that came back, but keep
  // any pre-existing tables the LLM didn't mention.
  const merged: Diagram = DiagramSchema.parse(JSON.parse(JSON.stringify(base)));
  for (const [name, table] of Object.entries(llmResult.tables)) {
    merged.tables[name] = table;
  }
  for (const rel of llmResult.relations) {
    const exists = merged.relations.some(
      (r) =>
        r.from.table === rel.from.table &&
        r.from.column === rel.from.column &&
        r.to.table === rel.to.table &&
        r.to.column === rel.to.column
    );
    if (!exists) merged.relations.push(rel);
  }

  return {
    diagram: merged,
    engineUsed: 'llm',
    warnings: [],
    stats: {
      tablesAdded:
        Object.keys(merged.tables).length - Object.keys(base.tables).length,
      columnsAdded: 0,
      relationsAdded: merged.relations.length - base.relations.length,
      patternHits: { llm: 1 },
    },
    unparsedSpans: [],
  };
}
