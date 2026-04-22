import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrateCli } from './migrate-cli.js';
import { runInitCli } from './init-cli.js';
import { startMcpServer } from './server.js';
import { startHttpServer } from './http-adapter.js';

const SUBCOMMANDS = ['serve', 'migrate', 'init', 'export', 'stdio', 'http'] as const;
type Subcommand = (typeof SUBCOMMANDS)[number];

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const first = argv[0];

  if (first === '--help' || first === '-h') {
    printHelp();
    return 0;
  }

  if (!first || !SUBCOMMANDS.includes(first as Subcommand)) {
    // No subcommand (or flags-only) — default to MCP stdio mode.
    return runStdio(argv);
  }

  const rest = argv.slice(1);
  switch (first as Subcommand) {
    case 'stdio':
      return runStdio(rest);
    case 'serve':
      return runServe(rest);
    case 'http':
      return runHttp(rest);
    case 'migrate':
      return runMigrateCli(rest);
    case 'init':
      return runInitCli(rest);
    case 'export':
      process.stderr.write(
        'viso-mcp export is not implemented yet. Use diagram_export_sql / diagram_export_mermaid via MCP, or export directly from the browser editor.\n'
      );
      return 2;
  }
}

async function runHttp(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      port: { type: 'string', short: 'p', default: '4000' },
      host: { type: 'string', default: '127.0.0.1' },
      file: { type: 'string', default: './schema.dbml' },
      'bpmn-file': { type: 'string', default: './process.bpmn.json' },
    },
    strict: false,
  });
  const port = Number.parseInt(String(values.port), 10);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    process.stderr.write(`Invalid --port "${values.port}". Expected an integer between 1 and 65535.\n`);
    return 2;
  }
  try {
    const app = await startHttpServer(
      port,
      {
        erdFile: values.file as string,
        bpmnFile: values['bpmn-file'] as string,
      },
      values.host as string
    );
    process.stderr.write(
      `viso-mcp HTTP adapter listening on http://${values.host}:${port}\n` +
        '  GET    /api/workspace/:id/bpmn\n' +
        '  PUT    /api/workspace/:id/bpmn\n' +
        '  POST   /api/workspace/:id/bpmn/nodes\n' +
        '  DELETE /api/workspace/:id/bpmn/nodes/:nodeId\n' +
        '  POST   /api/workspace/:id/bpmn/flows\n' +
        '  DELETE /api/workspace/:id/bpmn/flows?from=&to=\n' +
        '  GET    /api/workspace/:id/bpmn/export?format=json|mermaid\n' +
        '  GET    /api/workspace/:id/erd\n' +
        '  PUT    /api/workspace/:id/erd\n' +
        '  GET    /api/workspace/:id/erd/export?format=dbml|mermaid|sql|json\n' +
        '  WS     /api/workspace/:id/events\n'
    );
    const shutdown = async () => {
      await app.close();
      process.exit(0);
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (err) {
    process.stderr.write(`HTTP server failed to start: ${(err as Error).message}\n`);
    return 1;
  }
  return 0;
}

async function runStdio(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      file: { type: 'string', default: './schema.dbml' },
      'bpmn-file': { type: 'string', default: './process.bpmn.json' },
    },
    strict: false,
  });
  await startMcpServer({
    erdFile: values.file as string,
    bpmnFile: values['bpmn-file'] as string,
  });
  // startMcpServer resolves once the transport connects; the server keeps
  // running on its own event loop until stdin closes.
  return 0;
}

async function runServe(argv: string[]): Promise<number> {
  // `serve --http <port>` is an alias for `http --port <port>` so that the
  // hub-integration docs (which standardised on `viso-mcp serve --http 4000`)
  // keep working without a separate install pattern.
  const httpFlagIndex = argv.findIndex((a) => a === '--http');
  if (httpFlagIndex !== -1) {
    const rest = [...argv];
    const portArg = rest[httpFlagIndex + 1];
    rest.splice(httpFlagIndex, portArg && !portArg.startsWith('-') ? 2 : 1);
    if (portArg && !portArg.startsWith('-')) rest.unshift('--port', portArg);
    return runHttp(rest);
  }

  const positional = argv.filter((a) => !a.startsWith('-'));
  const fileArg = positional[0] || './schema.dbml';
  const absFile = resolve(fileArg);

  const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const child = spawn(
    'npx',
    ['vite', '--config', resolve(pkgRoot, 'vite.config.ts')],
    {
      cwd: pkgRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        VISO_FILE: absFile,
        DATEN_VIZ_FILE: absFile, // deprecated alias, removed in v1.1
      },
    }
  );

  return new Promise<number>((done) => {
    child.on('exit', (code) => done(code ?? 0));
  });
}

function printHelp() {
  process.stderr.write(
    `viso-mcp — agent-native diagram editor (ERD/DBML + BPMN)

Usage:
  viso-mcp [--file <schema.dbml>] [--bpmn-file <process.bpmn.json>]
      Start MCP stdio server (default — what .mcp.json invokes).

  viso-mcp stdio  [flags]
      Explicit stdio mode, same as above.

  viso-mcp init   [--file ...] [--bpmn-file ...] [--global] [--dry-run]
      Write or merge a .mcp.json entry for this workspace.

  viso-mcp migrate <file.erd.json> [more files...]
      Convert a legacy daten-viz-erd-v1 JSON file to DBML.

  viso-mcp serve  [file.dbml]
      Start the browser preview (Vite).

  viso-mcp http   [--port 4000] [--host 127.0.0.1] [--file ...] [--bpmn-file ...]
      Start the HTTP API adapter (Fastify) for hub integrations.

  viso-mcp export <format>
      (placeholder — ships in v1.1)
`
  );
}

main().then(
  (code) => {
    if (code !== 0) process.exit(code);
    // Code 0 + stdio mode: leave the process alive so MCP transport works.
  },
  (err) => {
    process.stderr.write(`Fatal: ${err}\n`);
    process.exit(1);
  }
);
