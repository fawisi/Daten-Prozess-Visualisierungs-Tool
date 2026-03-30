import { parseArgs } from 'node:util';

const { positionals } = parseArgs({
  allowPositionals: true,
  strict: false,
});

const command = positionals[0];

if (command === 'serve') {
  // Phase 2: Will launch Vite dev server
  const { startPreview } = await import('./preview/start-preview.js');
  const fileArg = positionals[1] || './schema.erd.json';
  await startPreview(fileArg);
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
