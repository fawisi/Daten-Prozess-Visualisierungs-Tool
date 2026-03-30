import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DiagramSchema } from '../schema.js';
import { toMermaid } from './mermaid.js';

const filePath = process.argv[2];
if (!filePath) {
  process.stderr.write('Usage: export-mermaid <schema.erd.json>\n');
  process.exit(1);
}

async function main() {
  const raw = await readFile(resolve(filePath), 'utf-8');
  const diagram = DiagramSchema.parse(JSON.parse(raw));
  process.stdout.write(toMermaid(diagram));
}

main().catch((err) => {
  process.stderr.write(`Error: ${err}\n`);
  process.exit(1);
});
