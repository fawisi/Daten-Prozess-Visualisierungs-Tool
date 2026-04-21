import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import {
  ColumnSchema,
  RelationSchema,
  SafeIdentifier,
  TableSchema,
} from './schema.js';
import type { Diagram } from './schema.js';
import { DbmlStore } from './dbml-store.js';

/**
 * The legacy JSON shape as it existed in `daten-viz-mcp@0.2.0`. We only
 * read files in this shape here — everything else in the codebase operates
 * on the current `viso-erd-v1` format.
 */
const LegacyDiagramSchema = z.object({
  format: z.literal('daten-viz-erd-v1'),
  name: z.string().max(256).optional(),
  tables: z.record(SafeIdentifier, TableSchema),
  relations: z.array(RelationSchema),
});

export interface MigrationResult {
  sourcePath: string;
  dbmlPath: string;
  backupPath: string;
  tableCount: number;
  relationCount: number;
  noteTruncations: string[];
}

const NOTE_MAX_LENGTH = 200;

export async function migrateFile(sourcePath: string): Promise<MigrationResult> {
  const absSource = resolve(sourcePath);
  if (!absSource.endsWith('.erd.json')) {
    throw new Error(
      `Expected a legacy .erd.json file, got: ${sourcePath}. Migration only runs on daten-viz-erd-v1 files.`
    );
  }

  const raw = await readFile(absSource, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in ${sourcePath}.`);
  }

  const legacy = LegacyDiagramSchema.safeParse(parsed);
  if (!legacy.success) {
    throw new Error(
      `Not a valid daten-viz-erd-v1 file (${sourcePath}): ${legacy.error.message}`
    );
  }

  const noteTruncations: string[] = [];
  const diagram: Diagram = {
    format: 'viso-erd-v1',
    tables: {},
    relations: legacy.data.relations,
  };
  if (legacy.data.name) diagram.name = legacy.data.name;

  for (const [tableName, table] of Object.entries(legacy.data.tables)) {
    const truncatedDescription = truncateNote(
      table.description,
      noteTruncations,
      `tables.${tableName}`
    );
    diagram.tables[tableName] = {
      columns: table.columns.map((col) => ({
        ...col,
        description: truncateNote(
          col.description,
          noteTruncations,
          `tables.${tableName}.columns.${col.name}`
        ),
      })),
      ...(truncatedDescription ? { description: truncatedDescription } : {}),
    };
  }

  const dbmlPath = absSource.replace(/\.erd\.json$/, '.dbml');
  const backupPath = absSource + '.bak';

  // 1) Create backup via rename so the original is never left in a half-state
  await rename(absSource, backupPath);
  // 2) Write the new .dbml beside it
  await new DbmlStore(dbmlPath).save(diagram);
  // 3) Copy backup back to the original path — keeps the old file on disk so
  //    downstream tools that still reference schema.erd.json can find it
  //    until the user is fully switched over. We keep the .bak stamp so it
  //    is discoverable, and restore the source by re-reading the backup.
  await writeFile(absSource, await readFile(backupPath, 'utf-8'), 'utf-8');

  return {
    sourcePath: absSource,
    dbmlPath,
    backupPath,
    tableCount: Object.keys(diagram.tables).length,
    relationCount: diagram.relations.length,
    noteTruncations,
  };
}

function truncateNote(
  note: string | undefined,
  log: string[],
  location: string
): string | undefined {
  if (!note) return undefined;
  if (note.length <= NOTE_MAX_LENGTH) return note;
  log.push(`${location} (${note.length} chars, truncated to ${NOTE_MAX_LENGTH})`);
  return note.slice(0, NOTE_MAX_LENGTH - 1) + '\u2026';
}

export async function runMigrateCli(argv: string[]): Promise<number> {
  if (argv.length === 0) {
    process.stderr.write(
      'Usage: viso-mcp migrate <file.erd.json> [more files...]\n'
    );
    return 2;
  }

  let failures = 0;
  for (const arg of argv) {
    try {
      const result = await migrateFile(arg);
      process.stdout.write(
        `migrated: ${result.sourcePath}\n` +
          `  -> ${result.dbmlPath}\n` +
          `  backup: ${result.backupPath}\n` +
          `  ${result.tableCount} table(s), ${result.relationCount} relation(s)\n`
      );
      for (const trunc of result.noteTruncations) {
        process.stderr.write(`  warning: truncated note ${trunc}\n`);
      }
    } catch (err) {
      failures++;
      process.stderr.write(`error: ${arg}: ${(err as Error).message}\n`);
    }
  }
  return failures === 0 ? 0 : 1;
}
