import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { DiagramStore } from './store.js';
import { registerTools } from './tools.js';

const { values } = parseArgs({
  options: {
    file: { type: 'string', default: './schema.erd.json' },
  },
  strict: false,
});

const filePath = resolve(values.file as string);
const store = new DiagramStore(filePath);

const server = new McpServer({
  name: 'daten-viz-mcp',
  version: '0.1.0',
});

registerTools(server, store);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
