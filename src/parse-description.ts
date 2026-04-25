import { normalizeText, MAX_NARRATIVE_INPUT_CHARS } from './narrative/shared.js';
import { DEFAULT_PARSE_CONFIG } from './narrative/config.js';
import type { ParseDescriptionConfig } from './narrative/config.js';
import { DiagramSchema, emptyDiagram } from './schema.js';
import type { Diagram, Column } from './schema.js';

/**
 * ERD narrative parser (plan R5). Ships with one flagship pattern:
 * "Tabelle X hat a, b, c" → table X with columns {a, b, c}. Primary
 * key is `id` when present, or the first column if none matches. Each
 * column defaults to type `text` — the consultant types it manually
 * in the PropertiesPanel afterwards. This intentionally keeps ERD
 * narrative shallow; SQL-fluent users reach for DBML directly.
 */

const TABLE_PATTERN =
  /^Tabelle\s+([a-zA-Z_][a-zA-Z0-9_]{0,62})\s+hat\s+(.+?)[.,;]?$/iu;

const COLUMN_PATTERN = /^([a-zA-Z_][a-zA-Z0-9_]{0,62})(?:\s+als\s+([a-zA-Z][a-zA-Z0-9()_]{0,31}))?$/i;

export interface ErdParseResult {
  diagram: Diagram;
  engineUsed: 'regex' | 'llm';
  warnings: string[];
  stats: { tablesAdded: number; columnsAdded: number; patternHits: Record<string, number> };
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
    warnings.push(
      'config.engine="llm": MCP sampling is not host-supported yet. Falling back to regex.'
    );
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
  let columnsAdded = 0;
  const stats = {
    tablesAdded: 0,
    columnsAdded: 0,
    patternHits: {} as Record<string, number>,
  };

  const lines = input.split(/[.!?\n;]+/).map((s) => s.trim()).filter(Boolean);
  const unparsedSpans: string[] = [];

  for (const line of lines) {
    const m = line.match(TABLE_PATTERN);
    if (!m) {
      unparsedSpans.push(line);
      continue;
    }
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
    // Guarantee a primary key: use `id` if present, else mark first col.
    if (!columns.some((c) => c.primary)) columns[0].primary = true;
    if (diagram.tables[name]) {
      // Merge columns — only add ones that are new.
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
  }

  stats.tablesAdded = Object.keys(diagram.tables).length - tablesAtStart;
  stats.columnsAdded = columnsAdded;

  return { diagram, engineUsed, warnings, stats, unparsedSpans };
}
