import { readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { DiagramSchema, emptyDiagram } from './schema.js';
import type { Diagram } from './schema.js';

export class DiagramStore {
  constructor(private filePath: string) {}

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

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Invalid JSON in ${this.filePath}`);
    }

    const result = DiagramSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Invalid schema in ${this.filePath}: ${result.error.message}`
      );
    }
    return result.data;
  }

  async save(diagram: Diagram): Promise<void> {
    const json = JSON.stringify(diagram, null, 2) + '\n';
    const dir = dirname(this.filePath);
    const tmp = join(dir, `.tmp-${randomUUID()}.json`);
    await writeFile(tmp, json, 'utf-8');
    await rename(tmp, this.filePath);
  }
}
