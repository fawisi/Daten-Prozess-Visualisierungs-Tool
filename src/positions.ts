import { readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';

/**
 * Given a source-of-truth path (either `schema.dbml`, `schema.erd.json`,
 * or `process.bpmn.json`), return the expected positions-sidecar path.
 * ERD sources keep the legacy `.erd.pos.json` suffix so existing repos
 * keep working after the DBML migration.
 */
export function derivePositionsPath(sourcePath: string): string {
  if (sourcePath.endsWith('.dbml')) {
    return sourcePath.replace(/\.dbml$/, '.erd.pos.json');
  }
  if (sourcePath.endsWith('.erd.json')) {
    return sourcePath.replace(/\.erd\.json$/, '.erd.pos.json');
  }
  if (sourcePath.endsWith('.bpmn.json')) {
    return sourcePath.replace(/\.bpmn\.json$/, '.bpmn.pos.json');
  }
  return sourcePath + '.pos.json';
}

/**
 * Remove entries whose key is not in `validIds` from the positions file.
 * Non-existent sidecar files are a no-op. Returns the list of IDs that
 * were pruned so the caller can surface it in the tool response.
 */
export async function prunePositions(
  sidecarPath: string,
  validIds: ReadonlySet<string>
): Promise<string[]> {
  let raw: string;
  try {
    raw = await readFile(sidecarPath, 'utf-8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Malformed positions file — leave it alone rather than rewriting
    // garbage back to disk. The preview will overwrite it on next edit.
    return [];
  }

  const removed: string[] = [];
  const kept: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(parsed)) {
    if (validIds.has(id)) {
      kept[id] = value;
    } else {
      removed.push(id);
    }
  }

  if (removed.length === 0) return [];

  const dir = dirname(sidecarPath);
  const tmp = join(dir, `.tmp-${randomUUID()}.json`);
  await writeFile(tmp, JSON.stringify(kept, null, 2) + '\n', 'utf-8');
  await rename(tmp, sidecarPath);
  return removed;
}
