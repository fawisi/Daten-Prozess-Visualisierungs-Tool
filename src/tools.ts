import { z } from 'zod';
import { writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SafeIdentifier, ColumnType, RelationType, DiagramSchema } from './schema.js';
import { toMermaid } from './export/mermaid.js';
import { DbmlStore, diagramToDbml, rawDatabaseToDiagram } from './dbml-store.js';
import { Parser, exporter } from '@dbml/core';
import { derivePositionsPath, prunePositions } from './positions.js';
import type { Diagram, Column } from './schema.js';
import type { ErdStore } from './erd-store-interface.js';

function schemaSummary(d: Diagram): string {
  const t = Object.keys(d.tables).length;
  const r = d.relations.length;
  return `Schema now has ${t} table${t !== 1 ? 's' : ''}, ${r} relation${r !== 1 ? 's' : ''}.`;
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function problemResult(body: Record<string, unknown>) {
  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(body, null, 2),
      },
    ],
  };
}

interface DbmlDiag {
  message?: string;
  code?: number | string;
  start?: { line: number; column: number };
  end?: { line: number; column: number };
}

function extractDbmlDiagnostics(err: unknown): DbmlDiag[] {
  const diags = (err as { diags?: unknown[] })?.diags;
  if (!Array.isArray(diags)) return [];
  return diags.map((d) => {
    const diag = d as Record<string, unknown>;
    return {
      message: (diag.message as string | undefined) ?? (diag.msg as string | undefined),
      code: diag.code as number | string | undefined,
      start: diag.start as DbmlDiag['start'],
      end: diag.end as DbmlDiag['end'],
    };
  });
}

function reconstructDiagramOrNull(rawDatabase: unknown): Diagram | null {
  try {
    const diagram = rawDatabaseToDiagram(
      rawDatabase as Parameters<typeof rawDatabaseToDiagram>[0]
    );
    const check = DiagramSchema.safeParse(diagram);
    return check.success ? check.data : null;
  } catch {
    return null;
  }
}

export function registerTools(server: McpServer, store: ErdStore) {
  // --- diagram_create_table ---
  server.registerTool(
    'diagram_create_table',
    {
      description: 'Create a new table in the ER diagram',
      inputSchema: z.object({
        name: SafeIdentifier.describe('Table name'),
        columns: z
          .array(
            z.object({
              name: SafeIdentifier.describe('Column name'),
              type: ColumnType.describe('Column data type (e.g. uuid, varchar, integer)'),
              primary: z.boolean().optional().describe('Is this a primary key?'),
              nullable: z.boolean().optional().describe('Allow NULL values?'),
              description: z.string().max(512).optional().describe('Column description'),
            })
          )
          .min(1, 'A table must have at least one column')
          .describe('Table columns'),
        description: z.string().max(512).optional().describe('Table description'),
      }),
    },
    async ({ name, columns, description }) => {
      const diagram = await store.load();
      if (diagram.tables[name]) {
        return textResult(`Table "${name}" already exists. Use diagram_remove_table first if you want to recreate it.`);
      }
      diagram.tables[name] = {
        columns: columns as Column[],
        ...(description ? { description } : {}),
      };
      await store.save(diagram);
      return textResult(
        `Created table "${name}" with ${columns.length} column${columns.length !== 1 ? 's' : ''}. ${schemaSummary(diagram)}`
      );
    }
  );

  // --- diagram_remove_table ---
  server.registerTool(
    'diagram_remove_table',
    {
      description:
        'Remove a table and all its relations from the ER diagram',
      inputSchema: z.object({
        name: SafeIdentifier.describe('Name of the table to remove'),
      }),
    },
    async ({ name }) => {
      const diagram = await store.load();
      if (!diagram.tables[name]) {
        const available = Object.keys(diagram.tables).join(', ') || '(none)';
        return textResult(
          `Table "${name}" not found. Available tables: ${available}.`
        );
      }
      delete diagram.tables[name];
      const before = diagram.relations.length;
      diagram.relations = diagram.relations.filter(
        (r) => r.from.table !== name && r.to.table !== name
      );
      const cascaded = before - diagram.relations.length;
      await store.save(diagram);
      return textResult(
        `Removed table "${name}"${cascaded > 0 ? ` and ${cascaded} related relation${cascaded !== 1 ? 's' : ''}` : ''}. ${schemaSummary(diagram)}`
      );
    }
  );

  // --- diagram_add_column ---
  server.registerTool(
    'diagram_add_column',
    {
      description: 'Add a column to an existing table',
      inputSchema: z.object({
        table: SafeIdentifier.describe('Table to add the column to'),
        column: z.object({
          name: SafeIdentifier.describe('Column name'),
          type: ColumnType.describe('Column data type'),
          primary: z.boolean().optional().describe('Is this a primary key?'),
          nullable: z.boolean().optional().describe('Allow NULL values?'),
          description: z.string().max(512).optional().describe('Column description'),
        }),
      }),
    },
    async ({ table, column }) => {
      const diagram = await store.load();
      const t = diagram.tables[table];
      if (!t) {
        const available = Object.keys(diagram.tables).join(', ') || '(none)';
        return textResult(
          `Table "${table}" not found. Available tables: ${available}.`
        );
      }
      if (t.columns.some((c) => c.name === column.name)) {
        return textResult(
          `Column "${column.name}" already exists in table "${table}".`
        );
      }
      t.columns.push(column as Column);
      await store.save(diagram);
      return textResult(
        `Added column "${column.name}" to table "${table}". Table now has ${t.columns.length} column${t.columns.length !== 1 ? 's' : ''}.`
      );
    }
  );

  // --- diagram_remove_column ---
  server.registerTool(
    'diagram_remove_column',
    {
      description: 'Remove a column from a table',
      inputSchema: z.object({
        table: SafeIdentifier.describe('Table containing the column'),
        columnName: SafeIdentifier.describe('Name of the column to remove'),
      }),
    },
    async ({ table, columnName }) => {
      const diagram = await store.load();
      const t = diagram.tables[table];
      if (!t) {
        const available = Object.keys(diagram.tables).join(', ') || '(none)';
        return textResult(
          `Table "${table}" not found. Available tables: ${available}.`
        );
      }
      const idx = t.columns.findIndex((c) => c.name === columnName);
      if (idx === -1) {
        const available = t.columns.map((c) => c.name).join(', ');
        return textResult(
          `Column "${columnName}" not found in table "${table}". Available columns: ${available}.`
        );
      }
      if (t.columns.length === 1) {
        return textResult(
          `Cannot remove the last column from table "${table}". Use diagram_remove_table to remove the entire table.`
        );
      }
      t.columns.splice(idx, 1);
      await store.save(diagram);
      return textResult(
        `Removed column "${columnName}" from table "${table}". Table now has ${t.columns.length} column${t.columns.length !== 1 ? 's' : ''}.`
      );
    }
  );

  // --- diagram_add_relation ---
  server.registerTool(
    'diagram_add_relation',
    {
      description: 'Add a foreign key relation between two tables',
      inputSchema: z.object({
        fromTable: SafeIdentifier.describe('Source table'),
        fromColumn: SafeIdentifier.describe('Source column (FK)'),
        toTable: SafeIdentifier.describe('Target table'),
        toColumn: SafeIdentifier.describe('Target column (usually PK)'),
        type: RelationType.describe('Relation cardinality'),
      }),
    },
    async ({ fromTable, fromColumn, toTable, toColumn, type }) => {
      const diagram = await store.load();

      // Validate tables exist
      if (!diagram.tables[fromTable]) {
        return textResult(`Table "${fromTable}" not found.`);
      }
      if (!diagram.tables[toTable]) {
        return textResult(`Table "${toTable}" not found.`);
      }

      // Validate columns exist
      if (!diagram.tables[fromTable].columns.some((c) => c.name === fromColumn)) {
        const available = diagram.tables[fromTable].columns
          .map((c) => c.name)
          .join(', ');
        return textResult(
          `Column "${fromColumn}" not found in table "${fromTable}". Available columns: ${available}.`
        );
      }
      if (!diagram.tables[toTable].columns.some((c) => c.name === toColumn)) {
        const available = diagram.tables[toTable].columns
          .map((c) => c.name)
          .join(', ');
        return textResult(
          `Column "${toColumn}" not found in table "${toTable}". Available columns: ${available}.`
        );
      }

      // Check duplicate
      const exists = diagram.relations.some(
        (r) =>
          r.from.table === fromTable &&
          r.from.column === fromColumn &&
          r.to.table === toTable &&
          r.to.column === toColumn
      );
      if (exists) {
        return textResult(
          `Relation from "${fromTable}.${fromColumn}" to "${toTable}.${toColumn}" already exists.`
        );
      }

      diagram.relations.push({
        from: { table: fromTable, column: fromColumn },
        to: { table: toTable, column: toColumn },
        type,
      });
      await store.save(diagram);
      return textResult(
        `Added ${type} relation from "${fromTable}.${fromColumn}" to "${toTable}.${toColumn}". ${schemaSummary(diagram)}`
      );
    }
  );

  // --- diagram_remove_relation ---
  server.registerTool(
    'diagram_remove_relation',
    {
      description: 'Remove a relation by its source table and column',
      inputSchema: z.object({
        fromTable: SafeIdentifier.describe('Source table of the relation'),
        fromColumn: SafeIdentifier.describe('Source column of the relation'),
      }),
    },
    async ({ fromTable, fromColumn }) => {
      const diagram = await store.load();
      const before = diagram.relations.length;
      diagram.relations = diagram.relations.filter(
        (r) => !(r.from.table === fromTable && r.from.column === fromColumn)
      );
      const removed = before - diagram.relations.length;
      if (removed === 0) {
        return textResult(
          `No relation found from "${fromTable}.${fromColumn}".`
        );
      }
      await store.save(diagram);
      return textResult(
        `Removed ${removed} relation${removed !== 1 ? 's' : ''} from "${fromTable}.${fromColumn}". ${schemaSummary(diagram)}`
      );
    }
  );

  // --- diagram_get_schema ---
  server.registerTool(
    'diagram_get_schema',
    {
      description: 'Read the current ER diagram schema as compact JSON',
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      const diagram = await store.load();
      return textResult(JSON.stringify(diagram, null, 2));
    }
  );

  // --- diagram_export_mermaid ---
  server.registerTool(
    'diagram_export_mermaid',
    {
      description:
        'Export the current ER diagram as Mermaid erDiagram syntax for documentation',
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      const diagram = await store.load();
      if (Object.keys(diagram.tables).length === 0) {
        return textResult('Schema is empty. Create tables first.');
      }
      return textResult(toMermaid(diagram));
    }
  );

  // --- set_dbml ---
  server.registerTool(
    'set_dbml',
    {
      description:
        'Replace the entire ERD with new DBML text in one call. Atomic — the file stays unchanged on parse error. Orphan positions (tables that no longer exist) are pruned from the sidecar.',
      inputSchema: z.object({
        dbml: z
          .string()
          .min(1, 'DBML text cannot be empty')
          .describe('Complete DBML schema as a single string'),
      }),
    },
    async ({ dbml }) => {
      // Only DbmlStore has a .dbml-backed file path. For legacy JSON stores
      // we reject rather than silently converting the backing format.
      if (!(store instanceof DbmlStore)) {
        return problemResult({
          type: 'https://viso-mcp.dev/problems/unsupported-backing-store',
          title: 'set_dbml requires a DBML-backed store',
          detail:
            'The current ERD file is not a .dbml file. Run `npx viso-mcp migrate <file>` to switch to DBML first.',
        });
      }

      let parsedRaw: unknown;
      try {
        parsedRaw = Parser.parseDBMLToJSONv2(dbml);
      } catch (err) {
        return problemResult({
          type: 'https://viso-mcp.dev/problems/dbml-parse-error',
          title: 'DBML parse error',
          detail:
            (err as Error).message ||
            'DBML compiler reported one or more diagnostics — see errors[].',
          errors: extractDbmlDiagnostics(err),
        });
      }

      // Reload via DbmlStore.load() after the write would be the cleanest
      // validator, but that would persist invalid state on failure. Instead
      // we run the same rawDatabase -> Diagram mapping against an in-memory
      // write by delegating to a DbmlStore with the path we are about to
      // write to — the actual filesystem write only happens once we know
      // validation passed.
      const tmpDiagram = reconstructDiagramOrNull(parsedRaw);
      if (!tmpDiagram) {
        return problemResult({
          type: 'https://viso-mcp.dev/problems/dbml-schema-invalid',
          title: 'DBML parsed but failed internal schema validation',
          detail:
            'Reserved identifier or unsupported table/column shape. Check that table and column names match /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/.',
        });
      }

      // Atomic write: tmp file + rename. Preserves the original DBML text
      // so features our internal Diagram cannot represent (indexes, enums,
      // TableGroups) survive round-trips through set_dbml.
      const dir = dirname(store.filePath);
      const tmp = join(dir, `.tmp-${randomUUID()}.dbml`);
      await writeFile(tmp, dbml.endsWith('\n') ? dbml : dbml + '\n', 'utf-8');
      await rename(tmp, store.filePath);

      // Prune orphan positions
      const validTableIds = new Set(Object.keys(tmpDiagram.tables));
      const prunedIds = await prunePositions(
        derivePositionsPath(store.filePath),
        validTableIds
      );

      return textResult(
        JSON.stringify(
          {
            ok: true,
            tableCount: Object.keys(tmpDiagram.tables).length,
            relationCount: tmpDiagram.relations.length,
            prunedPositions: prunedIds,
          },
          null,
          2
        )
      );
    }
  );

  // --- diagram_export_sql ---
  server.registerTool(
    'diagram_export_sql',
    {
      description:
        'Export the current ER diagram as SQL DDL for postgres or mysql (mssql/oracle/snowflake ship in v1.1)',
      inputSchema: z.object({
        dialect: z.enum(['postgres', 'mysql']).describe('SQL dialect'),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ dialect }) => {
      const diagram = await store.load();
      if (Object.keys(diagram.tables).length === 0) {
        return textResult('Schema is empty. Create tables first.');
      }
      const dbml = diagramToDbml(diagram);
      try {
        const sql = exporter.export(dbml, dialect);
        return textResult(sql);
      } catch (err) {
        return textResult(
          `SQL export failed for dialect ${dialect}: ${(err as Error).message}`
        );
      }
    }
  );
}
