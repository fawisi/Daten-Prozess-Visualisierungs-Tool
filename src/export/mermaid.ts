import type { Diagram, Relation } from '../schema.js';
import { applyMermaidTheme } from '../theme.js';

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
      const comment = col.description ? ` "${col.description}"` : '';
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
    const label = `${rel.from.column} -> ${rel.to.column}`;
    lines.push(`    ${rel.from.table} ${card} ${rel.to.table} : "${label}"`);
  }

  const body = lines.join('\n') + '\n';
  return options.theme ? applyMermaidTheme(body, options.theme) : body;
}
