import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { DiagramStore } from './store.js';
import { DbmlStore } from './dbml-store.js';
import { registerTools } from './tools.js';
import { ProcessStore } from './bpmn/store.js';
import { registerProcessTools } from './bpmn/tools.js';
import { runMigrateCli } from './migrate-cli.js';
import type { ErdStore } from './erd-store-interface.js';

async function main() {
  // `viso-mcp migrate ./schema.erd.json ...` dispatches to the one-shot CLI
  // before any MCP transport boots. The full subcommand router (init,
  // export, serve) lands in Phase 3; keeping this here for now so Phase 1
  // migrations are reachable via the single `viso-mcp` binary.
  const argv = process.argv.slice(2);
  if (argv[0] === 'migrate') {
    const code = await runMigrateCli(argv.slice(1));
    process.exit(code);
  }

  const { values } = parseArgs({
    options: {
      file: { type: 'string', default: './schema.dbml' },
      'bpmn-file': { type: 'string', default: './process.bpmn.json' },
    },
    strict: false,
  });

  const erdPath = resolve(values.file as string);
  const bpmnPath = resolve(values['bpmn-file'] as string);

  const erdStore: ErdStore = selectErdStore(erdPath);
  const bpmnStore = new ProcessStore(bpmnPath);

  const server = new McpServer({
    name: 'viso-mcp',
    version: '1.0.0',
  });

  registerTools(server, erdStore);
  registerProcessTools(server, bpmnStore);

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

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
