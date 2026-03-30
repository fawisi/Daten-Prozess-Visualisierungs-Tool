import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { positionals } = parseArgs({
  allowPositionals: true,
  strict: false,
});

const command = positionals[0];

if (command === 'serve') {
  const fileArg = positionals[1] || './schema.erd.json';
  const absFile = resolve(fileArg);

  // Spawn vite with the project's vite.config.ts
  const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const child = spawn('npx', ['vite', '--config', resolve(pkgRoot, 'vite.config.ts')], {
    cwd: pkgRoot,
    stdio: 'inherit',
    env: { ...process.env, DATEN_VIZ_FILE: absFile },
  });

  child.on('exit', (code) => process.exit(code ?? 0));
} else {
  process.stderr.write(
    `daten-viz - ER Diagram Visualization Tool

Usage:
  daten-viz serve [file]    Start browser preview (default: ./schema.erd.json)

MCP Server:
  daten-viz-mcp [--file path]    Start MCP server via stdio
`
  );
  process.exit(command ? 1 : 0);
}
