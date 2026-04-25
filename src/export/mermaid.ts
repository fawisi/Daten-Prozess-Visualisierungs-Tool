import type { Diagram, Relation } from '../schema.js';
import { applyMermaidTheme, statusClassDefs, statusClassName } from '../theme.js';
import { escapeMermaidLabel } from './mermaid-escape.js';

const CARDINALITY_MAP: Record<string, string> = {
  'one-to-one': '||--||',
  'one-to-many': '||--o{',
  'many-to-one': '}o--||',
  'many-to-many': '}o--o{',
};

export interface MermaidExportOptions {
  theme?: 'light' | 'dark';
}

export function toMermaid(diagram: Diagram, options: MermaidExportOptions = {}): string {
  const lines: string[] = ['erDiagram'];

  // Sort table keys for deterministic output
  const tableNames = Object.keys(diagram.tables).sort();

  for (const name of tableNames) {
    const table = diagram.tables[name];
    lines.push(`    ${name} {`);
    for (const col of table.columns) {
      const attrs: string[] = [];
      if (col.primary) attrs.push('PK');
      if (col.nullable === false) attrs.push('"NOT NULL"');
      const attrStr = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
      const comment = col.description
        ? ` "${escapeMermaidLabel(col.description)}"`
        : '';
      lines.push(`        ${col.type} ${col.name}${attrStr}${comment}`);
    }
    lines.push('    }');
  }

  // Sort relations for deterministic output
  const sortedRelations = [...diagram.relations].sort((a, b) => {
    const aKey = `${a.from.table}.${a.from.column}-${a.to.table}.${a.to.column}`;
    const bKey = `${b.from.table}.${b.from.column}-${b.to.table}.${b.to.column}`;
    return aKey.localeCompare(bKey);
  });

  for (const rel of sortedRelations) {
    const card = CARDINALITY_MAP[rel.type] || '||--||';
    // The relation label is code-derived (column names, ASCII arrow) so
    // escaping is a belt-and-braces defense against future refactors that
    // might let user input flow in here.
    const label = escapeMermaidLabel(`${rel.from.column} -> ${rel.to.column}`);
    lines.push(`    ${rel.from.table} ${card} ${rel.to.table} : "${label}"`);
  }

  // Mermaid `erDiagram` does not support classDefs on entities. Table-level
  // status is surfaced as a comment line so downstream tooling (and the
  // README in the handoff bundle) can still discover it; the inline SVG
  // can't style entities from here.
  const statusedTables = tableNames.filter((name) => diagram.tables[name].status);
  if (statusedTables.length > 0) {
    lines.push('    %% Table statuses (persistent EN values):');
    for (const name of statusedTables) {
      lines.push(`    %%   ${name}: ${diagram.tables[name].status}`);
    }
  }

  // classDef lines are legal at the end of an erDiagram block in recent
  // Mermaid versions but are ignored by the renderer for entities. We
  // still emit them when BPMN-style reuse picks the file up, so agents
  // can consume the same classDef palette across all diagram kinds.
  if (statusedTables.length > 0) {
    // Emit status helpers only for the statuses actually used.
    const used = new Set(statusedTables.map((n) => diagram.tables[n].status!));
    const defs = statusClassDefs().filter((line) => {
      if (used.has('open') && line.includes(' statusOpen ')) return true;
      if (used.has('done') && line.includes(' statusDone ')) return true;
      if (used.has('blocked') && line.includes(' statusBlocked ')) return true;
      return false;
    });
    lines.push(...defs);
    for (const s of ['open', 'done', 'blocked'] as const) {
      const names = statusedTables.filter((n) => diagram.tables[n].status === s);
      if (names.length > 0) {
        lines.push(`    class ${names.join(',')} ${statusClassName(s)}`);
      }
    }
  }

  const body = lines.join('\n') + '\n';
  return options.theme ? applyMermaidTheme(body, options.theme) : body;
}
