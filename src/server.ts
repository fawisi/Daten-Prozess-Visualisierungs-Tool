import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { DiagramStore } from './store.js';
import { registerTools } from './tools.js';
import { ProcessStore } from './bpmn/store.js';
import { registerProcessTools } from './bpmn/tools.js';

const { values } = parseArgs({
  options: {
    file: { type: 'string', default: './schema.erd.json' },
    'bpmn-file': { type: 'string', default: './process.bpmn.json' },
  },
  strict: false,
});

const erdPath = resolve(values.file as string);
const bpmnPath = resolve(values['bpmn-file'] as string);

const erdStore = new DiagramStore(erdPath);
const bpmnStore = new ProcessStore(bpmnPath);

const server = new McpServer({
  name: 'viso-mcp',
  version: '1.0.0',
});

registerTools(server, erdStore);
registerProcessTools(server, bpmnStore);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
