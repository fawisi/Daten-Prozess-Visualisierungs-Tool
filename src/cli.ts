import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrateCli } from './migrate-cli.js';
import { runInitCli } from './init-cli.js';
import { startMcpServer } from './server.js';

const SUBCOMMANDS = ['serve', 'migrate', 'init', 'export', 'stdio'] as const;
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
