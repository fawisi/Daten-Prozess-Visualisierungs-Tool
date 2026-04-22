import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { DiagramStore } from './store.js';
import { DbmlStore } from './dbml-store.js';
import { registerTools } from './tools.js';
import { ProcessStore } from './bpmn/store.js';
import { registerProcessTools } from './bpmn/tools.js';
import { LandscapeStore } from './landscape/store.js';
import { registerLandscapeTools } from './landscape/tools.js';
import type { ErdStore } from './erd-store-interface.js';

export interface McpServerOptions {
  erdFile?: string;
  bpmnFile?: string;
  landscapeFile?: string;
}

export async function startMcpServer(options: McpServerOptions = {}): Promise<void> {
  const erdPath = resolve(options.erdFile ?? './schema.dbml');
  const bpmnPath = resolve(options.bpmnFile ?? './process.bpmn.json');
  const landscapePath = resolve(options.landscapeFile ?? './landscape.landscape.json');

  const erdStore: ErdStore = selectErdStore(erdPath);
  const bpmnStore = new ProcessStore(bpmnPath);
  const landscapeStore = new LandscapeStore(landscapePath);

  const server = new McpServer({
    name: 'viso-mcp',
    version: '1.1.0-alpha',
  });

  registerTools(server, erdStore);
  registerProcessTools(server, bpmnStore);
  registerLandscapeTools(server, landscapeStore);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function selectErdStore(path: string): ErdStore {
  if (path.endsWith('.erd.json')) {
    process.stderr.write(
      `[viso] Legacy .erd.json detected: ${path}. Run 'npx viso-mcp migrate ${path}' to switch to DBML.\n`
    );
    return new DiagramStore(path);
  }
  return new DbmlStore(path);
}

// When invoked directly (e.g. `node dist/server.cjs --file ./schema.dbml`)
// fall through to the MCP stdio server. The full subcommand dispatcher
// lives in src/cli.ts which is the package's published bin.
if (process.argv[1]?.endsWith('server.cjs') || process.argv[1]?.endsWith('server.js')) {
  const { values } = parseArgs({
    options: {
      file: { type: 'string', default: './schema.dbml' },
      'bpmn-file': { type: 'string', default: './process.bpmn.json' },
      'landscape-file': { type: 'string', default: './landscape.landscape.json' },
    },
    strict: false,
  });

  startMcpServer({
    erdFile: values.file as string,
    bpmnFile: values['bpmn-file'] as string,
    landscapeFile: values['landscape-file'] as string,
  }).catch((err) => {
    process.stderr.write(`Fatal: ${err}\n`);
    process.exit(1);
  });
}
