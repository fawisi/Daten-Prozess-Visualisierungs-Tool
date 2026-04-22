import { readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { assertSidecarInsideRoot } from './positions.js';
import type { Diagram, NodeStatus_ } from './schema.js';

/**
 * DBML (the ERD backing format) has no native concept of "audit status"
 * on a table or column. We preserve it in a sidecar next to the source
 * file — `.erd.status.json` — so round-trips through the DBML save/load
 * pipeline don't lose consulting-state.
 *
 * Schema:
 *   {
 *     "version": "1.1",
 *     "tables": { "<tableName>": "open" | "done" | "blocked" },
 *     "columns": { "<tableName>.<columnName>": "open" | ... }
 *   }
 */
const StatusValue = z.enum(['open', 'done', 'blocked']);

export const ErdStatusSidecarSchema = z.object({
  // Pinned to literal so a v1.2+ release with breaking shape is rejected
  // rather than silently mis-parsed (kieran-review N7).
  version: z.literal('1.1').default('1.1'),
  tables: z.record(z.string(), StatusValue).default({}),
  columns: z.record(z.string(), StatusValue).default({}),
});

export type ErdStatusSidecar = z.infer<typeof ErdStatusSidecarSchema>;

function deriveStatusPath(sourcePath: string): string {
  if (sourcePath.endsWith('.dbml')) {
    return sourcePath.replace(/\.dbml$/, '.erd.status.json');
  }
  if (sourcePath.endsWith('.erd.json')) {
    return sourcePath.replace(/\.erd\.json$/, '.erd.status.json');
  }
  return sourcePath + '.status.json';
}

export async function loadErdStatusSidecar(
  sourcePath: string
): Promise<ErdStatusSidecar> {
  const path = deriveStatusPath(sourcePath);
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { version: '1.1', tables: {}, columns: {} };
    }
    throw err;
  }
  const parsed = ErdStatusSidecarSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`Invalid ERD status sidecar at ${path}: ${parsed.error.message}`);
  }
  return parsed.data;
}

async function saveErdStatusSidecar(
  sourcePath: string,
  data: ErdStatusSidecar
): Promise<void> {
  const path = deriveStatusPath(sourcePath);
  const safePath = assertSidecarInsideRoot(path, dirname(sourcePath));
  const json = JSON.stringify(data, null, 2) + '\n';
  const tmp = join(dirname(safePath), `.tmp-${randomUUID()}.json`);
  await writeFile(tmp, json, 'utf-8');
  await rename(tmp, safePath);
}

/** Apply the sidecar to an in-memory Diagram so consumers see status fields. */
export function applyStatusSidecar(diagram: Diagram, sidecar: ErdStatusSidecar): void {
  for (const [name, status] of Object.entries(sidecar.tables)) {
    const t = diagram.tables[name];
    if (t) t.status = status;
  }
  for (const [key, status] of Object.entries(sidecar.columns)) {
    const [tableName, columnName] = key.split('.');
    if (!tableName || !columnName) continue;
    const col = diagram.tables[tableName]?.columns.find((c) => c.name === columnName);
    if (col) col.status = status;
  }
}

export async function updateTableStatus(
  sourcePath: string,
  tableName: string,
  status: NodeStatus_ | null
): Promise<void> {
  const sidecar = await loadErdStatusSidecar(sourcePath);
  if (status === null) {
    delete sidecar.tables[tableName];
  } else {
    sidecar.tables[tableName] = status;
  }
  await saveErdStatusSidecar(sourcePath, sidecar);
}

export async function updateColumnStatus(
  sourcePath: string,
  tableName: string,
  columnName: string,
  status: NodeStatus_ | null
): Promise<void> {
  const sidecar = await loadErdStatusSidecar(sourcePath);
  const key = `${tableName}.${columnName}`;
  if (status === null) {
    delete sidecar.columns[key];
  } else {
    sidecar.columns[key] = status;
  }
  await saveErdStatusSidecar(sourcePath, sidecar);
}

/** Prune sidecar entries for tables / columns that no longer exist. */
export async function pruneErdStatusSidecar(
  sourcePath: string,
  diagram: Diagram
): Promise<string[]> {
  const sidecar = await loadErdStatusSidecar(sourcePath);
  const removed: string[] = [];

  for (const name of Object.keys(sidecar.tables)) {
    if (!diagram.tables[name]) {
      removed.push(`table:${name}`);
      delete sidecar.tables[name];
    }
  }
  for (const key of Object.keys(sidecar.columns)) {
    const [t, c] = key.split('.');
    const colExists = diagram.tables[t]?.columns.some((col) => col.name === c);
    if (!colExists) {
      removed.push(`column:${key}`);
      delete sidecar.columns[key];
    }
  }

  if (removed.length > 0) await saveErdStatusSidecar(sourcePath, sidecar);
  return removed;
}
