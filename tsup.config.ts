import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      cli: 'src/cli.ts',
      server: 'src/server.ts',
      'export-mermaid': 'src/export/mermaid-cli.ts',
    },
    format: ['cjs', 'esm'],
    target: 'node20',
    dts: false,
    clean: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
