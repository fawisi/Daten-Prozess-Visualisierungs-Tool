import { readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { deriveModePath, assertSidecarInsideRoot } from './positions.js';

/**
 * Mode sidecar schema. Built as a Zod discriminated union on `kind`
 * (plan R7 / R8) so a second branch (`landscape`, added in P2) can
 * slot in without breaking the loader contract. v1.1 P0 ships only
 * the `bpmn` branch — registering `LandscapeModeSidecarSchema` now
 * without a producer would let a sidecar get written to disk that no
 * tool can read.
 *
 * `version` is pinned to the literal `'1.1'` so a file written by a
 * future schema-v1.2 release (breaking shape) is rejected rather than
 * silently mis-parsed.
 */
export const BpmnModeSidecarSchema = z.object({
  kind: z.literal('bpmn'),
  mode: z.enum(['simple', 'bpmn']),
  version: z.literal('1.1'),
});

export const LandscapeModeSidecarSchema = z.object({
  kind: z.literal('landscape'),
  mode: z.enum(['l1', 'l2']),
  version: z.literal('1.1'),
});

export const ModeSidecarSchema = z.discriminatedUnion('kind', [
  BpmnModeSidecarSchema,
  LandscapeModeSidecarSchema,
]);

export type BpmnModeSidecar = z.infer<typeof BpmnModeSidecarSchema>;
export type LandscapeModeSidecar = z.infer<typeof LandscapeModeSidecarSchema>;
export type ModeSidecar = z.infer<typeof ModeSidecarSchema>;

/**
 * Load a mode sidecar. Returns `null` when the file does not exist;
 * throws for other IO errors or malformed content.
 */
export async function loadModeSidecar(sourcePath: string): Promise<ModeSidecar | null> {
  const sidecarPath = deriveModePath(sourcePath);
  let raw: string;
  try {
    raw = await readFile(sidecarPath, 'utf-8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in ${sidecarPath}`);
  }
  const result = ModeSidecarSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid mode sidecar at ${sidecarPath}: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Save a mode sidecar atomically (tmp + rename). The target path is
 * hard-anchored to the source file's directory to prevent traversal
 * (plan Security Req #4).
 */
export async function saveModeSidecar(
  sourcePath: string,
  data: ModeSidecar
): Promise<void> {
  const sidecarPath = deriveModePath(sourcePath);
  const root = dirname(sourcePath);
  const safePath = assertSidecarInsideRoot(sidecarPath, root);
  const json = JSON.stringify(data, null, 2) + '\n';
  const tmp = join(dirname(safePath), `.tmp-${randomUUID()}.json`);
  await writeFile(tmp, json, 'utf-8');
  await rename(tmp, safePath);
}
