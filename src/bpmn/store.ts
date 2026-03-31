import { readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { ProcessSchema, emptyProcess } from './schema.js';
import type { Process } from './schema.js';

export class ProcessStore {
  constructor(private filePath: string) {}

  async load(): Promise<Process> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf-8');
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return emptyProcess();
      }
      throw err;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Invalid JSON in ${this.filePath}`);
    }

    const result = ProcessSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Invalid schema in ${this.filePath}: ${result.error.message}`
      );
    }
    return result.data;
  }

  async save(process: Process): Promise<void> {
    const json = JSON.stringify(process, null, 2) + '\n';
    const dir = dirname(this.filePath);
    const tmp = join(dir, `.tmp-${randomUUID()}.json`);
    await writeFile(tmp, json, 'utf-8');
    await rename(tmp, this.filePath);
  }
}
