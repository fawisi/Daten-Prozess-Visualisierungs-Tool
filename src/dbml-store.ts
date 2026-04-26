import { readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { Parser } from '@dbml/core';
import { DiagramSchema, emptyDiagram, SafeIdentifier } from './schema.js';
import type {
  Column,
  Diagram,
  Relation,
  RelationType_,
  Table,
} from './schema.js';
import type { ErdStore } from './erd-store-interface.js';

/**
 * Schema mapping between the internal Diagram (Zod-validated) and DBML.
 *
 * | Internal Diagram                    | DBML equivalent          |
 * |-------------------------------------|--------------------------|
 * | tables[name].columns[].name         | Table.field.name         |
 * | tables[name].columns[].type         | Table.field.type         |
 * | tables[name].columns[].primary      | Table.field.pk           |
 * | tables[name].columns[].nullable     | !Table.field.not_null    |
 * | tables[name].description            | Table.note               |
 * | tables[name].columns[].description  | Table.field.note         |
 * | relations[]                         | Ref (with cardinality)   |
 * | (DBML-only, lossy on save)          | indexes, enum, TableGroup|
 *
 * v1.0 limitation: saving the Diagram back to DBML preserves tables,
 * columns, notes, and refs. DBML-only features (indexes, enums,
 * TableGroups) are NOT round-tripped — they live in the .dbml file only
 * as long as nothing mutates through the MCP tool surface. A
 * `.meta.json` sidecar for full-fidelity round-trips is tracked for v1.1.
 */
export class DbmlStore implements ErdStore {
  constructor(public readonly filePath: string) {}

  async load(): Promise<Diagram> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf-8');
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return emptyDiagram();
      }
      throw err;
    }

    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return emptyDiagram();
    }

    let parsed: RawDatabase;
    try {
      parsed = Parser.parseDBMLToJSONv2(raw) as RawDatabase;
    } catch (err: unknown) {
      throw new Error(
        `Invalid DBML in ${this.filePath}: ${(err as Error).message}`
      );
    }

    const diagram = rawDatabaseToDiagram(parsed);
    const result = DiagramSchema.safeParse(diagram);
    if (!result.success) {
      throw new Error(
        `DBML parsed but did not yield a valid internal diagram in ${this.filePath}: ${result.error.message}`
      );
    }
    return result.data;
  }

  async save(diagram: Diagram): Promise<void> {
    const dbml = diagramToDbml(diagram);
    const dir = dirname(this.filePath);
    const tmp = join(dir, `.tmp-${randomUUID()}.dbml`);
    await writeFile(tmp, dbml, 'utf-8');
    await rename(tmp, this.filePath);
  }
}

// --- DBML → Diagram ---

interface RawField {
  name: string;
  type: { type_name: string; args: string | null; schemaName: string | null };
  pk?: boolean;
  not_null?: boolean;
  note?: { value: string };
}

interface RawTable {
  name: string;
  fields: RawField[];
  indexes?: RawIndex[];
  note?: { value: string } | string;
}

interface RawIndex {
  columns: Array<{ value: string; type: 'column' | 'expression' }>;
  pk?: boolean;
  unique?: boolean;
}

interface RawEndpoint {
  fieldNames: string[];
  tableName: string;
  relation: '1' | '*';
}

interface RawRef {
  endpoints: [RawEndpoint, RawEndpoint];
}

interface RawDatabase {
  tables: RawTable[];
  refs: RawRef[];
  project?: { name?: string };
}

export function rawDatabaseToDiagram(raw: RawDatabase): Diagram {
  const tables: Diagram['tables'] = {};
  for (const t of raw.tables) {
    // DBML promotes multi-column [pk] attributes into an index with pk=true;
    // lift those back into field-level `primary` so single- and composite
    // PKs share one representation in the internal schema.
    const pkColumnsFromIndex = new Set<string>();
    for (const idx of t.indexes ?? []) {
      if (!idx.pk) continue;
      for (const col of idx.columns) {
        if (col.type === 'column') pkColumnsFromIndex.add(col.value);
      }
    }

    const columns: Column[] = t.fields.map((f) => {
      const c: Column = {
        name: f.name,
        type: f.type.type_name,
      };
      if (f.pk || pkColumnsFromIndex.has(f.name)) c.primary = true;
      if (f.not_null === true) c.nullable = false;
      if (f.not_null === false) c.nullable = true;
      const note = typeof f.note === 'object' ? f.note?.value : undefined;
      if (note) c.description = note;
      return c;
    });
    const tableNote =
      typeof t.note === 'object' ? t.note?.value : (t.note as string | undefined);
    const table: Table = {
      columns,
      ...(tableNote ? { description: tableNote } : {}),
    };
    tables[t.name] = table;
  }

  const relations: Relation[] = [];
  for (const ref of raw.refs) {
    const [left, right] = ref.endpoints;
    if (!left || !right) continue;
    if (left.fieldNames.length === 0 || right.fieldNames.length === 0) continue;
    // Ensure the referenced tables and columns survive validation
    if (!SafeIdentifier.safeParse(left.tableName).success) continue;
    if (!SafeIdentifier.safeParse(right.tableName).success) continue;
    relations.push({
      from: { table: left.tableName, column: left.fieldNames[0] },
      to: { table: right.tableName, column: right.fieldNames[0] },
      type: cardinalityToRelationType(left.relation, right.relation),
    });
  }

  const diagram: Diagram = {
    format: 'viso-erd-v1',
    tables,
    relations,
  };
  if (raw.project?.name) {
    diagram.name = raw.project.name;
  }
  return diagram;
}

function cardinalityToRelationType(
  from: '1' | '*',
  to: '1' | '*'
): RelationType_ {
  if (from === '*' && to === '1') return 'many-to-one';
  if (from === '1' && to === '*') return 'one-to-many';
  if (from === '*' && to === '*') return 'many-to-many';
  return 'one-to-one';
}

// --- Diagram → DBML ---

export function diagramToDbml(diagram: Diagram): string {
  const lines: string[] = [];
  if (diagram.name) {
    lines.push(`Project "${escapeQuoted(diagram.name)}" {`);
    lines.push(`  database_type: 'PostgreSQL'`);
    lines.push(`}`);
    lines.push('');
  }

  for (const [name, table] of Object.entries(diagram.tables)) {
    const needsQuotes = !isSimpleIdentifier(name);
    const tableName = needsQuotes ? `"${escapeQuoted(name)}"` : name;
    lines.push(`Table ${tableName} {`);
    for (const column of table.columns) {
      lines.push(`  ${formatColumn(column)}`);
    }
    if (table.description) {
      lines.push(`  Note: ${formatNote(table.description)}`);
    }
    lines.push(`}`);
    lines.push('');
  }

  for (const rel of diagram.relations) {
    const arrow = relationTypeToArrow(rel.type);
    lines.push(
      `Ref: ${qualify(rel.from.table)}.${qualify(rel.from.column)} ${arrow} ${qualify(rel.to.table)}.${qualify(rel.to.column)}`
    );
  }

  // Trailing newline so the file ends cleanly
  return lines.join('\n').replace(/\n+$/, '') + '\n';
}

function formatColumn(column: Column): string {
  const modifiers: string[] = [];
  if (column.primary) modifiers.push('pk');
  if (column.nullable === false) modifiers.push('not null');
  if (column.description) modifiers.push(`note: ${formatNote(column.description)}`);
  const typeStr = formatColumnType(column.type);
  const suffix = modifiers.length > 0 ? ` [${modifiers.join(', ')}]` : '';
  return `${qualify(column.name)} ${typeStr}${suffix}`;
}

function formatColumnType(type: string): string {
  // Types that contain parentheses or complex characters need quoting in DBML
  if (/^[a-zA-Z][a-zA-Z0-9_]*(\([^()]*\))?$/.test(type)) {
    return type;
  }
  return `"${escapeQuoted(type)}"`;
}

function formatNote(note: string): string {
  const singleLine = note.replace(/\s+/g, ' ').trim();
  return `'${singleLine.replace(/'/g, "\\'")}'`;
}

function qualify(name: string): string {
  return isSimpleIdentifier(name) ? name : `"${escapeQuoted(name)}"`;
}

function isSimpleIdentifier(str: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(str);
}

function escapeQuoted(str: string): string {
  return str.replace(/"/g, '\\"');
}

function relationTypeToArrow(type: RelationType_): string {
  switch (type) {
    case 'one-to-one':
      return '-';
    case 'one-to-many':
      return '<';
    case 'many-to-one':
      return '>';
    case 'many-to-many':
      return '<>';
  }
}

export const __test__ = {
  rawDatabaseToDiagram,
  diagramToDbml,
};
