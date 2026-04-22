import { readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve, sep } from 'node:path';

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
 * Derive the mode-sidecar path for a source file. Modes and levels are
 * persisted outside the schema so v1.0 files stay valid when loaded by
 * v1.1 (see plan-resolved-gap #1).
 *
 * - `process.bpmn.json` -> `process.bpmn.mode.json`
 * - `schema.dbml`       -> `schema.dbml.mode.json`
 * - `foo.landscape.json` -> `foo.landscape.mode.json`
 */
export function deriveModePath(sourcePath: string): string {
  if (sourcePath.endsWith('.bpmn.json')) {
    return sourcePath.replace(/\.bpmn\.json$/, '.bpmn.mode.json');
  }
  if (sourcePath.endsWith('.landscape.json')) {
    return sourcePath.replace(/\.landscape\.json$/, '.landscape.mode.json');
  }
  return sourcePath + '.mode.json';
}

/**
 * Guard against path-traversal when a caller suggests a sidecar path
 * that should be anchored to the source file's directory. If the
 * resolved `candidate` escapes `root`, we throw — the store should
 * never write outside the source's directory tree.
 *
 * Plan reference: P0 Security Requirement #4 (Sidecar-Path-Guard).
 */
export function assertSidecarInsideRoot(candidate: string, root: string): string {
  const resolvedCandidate = resolve(candidate);
  const resolvedRoot = resolve(root);
  const prefix = resolvedRoot.endsWith(sep) ? resolvedRoot : resolvedRoot + sep;
  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(prefix)) {
    throw new Error(
      `Refusing to write sidecar outside workspace root: ${resolvedCandidate}`
    );
  }
  return resolvedCandidate;
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
