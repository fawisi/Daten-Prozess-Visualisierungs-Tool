import { readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { LandscapeSchema, emptyLandscape } from './schema.js';
import type { Landscape } from './schema.js';

/**
 * Atomic FS-IO for a `.landscape.json` file. Mirrors `ProcessStore` and
 * `DiagramStore` (EN-first schema, tmp + rename write, safeParse on
 * load). Sidecars (.pos.json, .mode.json) are managed by their own
 * modules — `../positions.ts` / `../mode-sidecar.ts` — so the same
 * helpers cover BPMN + Landscape.
 */
export class LandscapeStore {
  constructor(public readonly filePath: string) {}

  async load(): Promise<Landscape> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf-8');
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return emptyLandscape();
      }
      throw err;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Invalid JSON in ${this.filePath}`);
    }
    const result = LandscapeSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Invalid landscape schema in ${this.filePath}: ${result.error.message}`
      );
    }
    return result.data;
  }

  async save(landscape: Landscape): Promise<void> {
    const json = JSON.stringify(landscape, null, 2) + '\n';
    const dir = dirname(this.filePath);
    const tmp = join(dir, `.tmp-${randomUUID()}.json`);
    await writeFile(tmp, json, 'utf-8');
    await rename(tmp, this.filePath);
  }
}
