import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      server: 'src/server.ts',
      'export-mermaid': 'src/export/mermaid-cli.ts',
    },
    format: ['cjs'],
    target: 'node20',
    dts: false,
    clean: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
