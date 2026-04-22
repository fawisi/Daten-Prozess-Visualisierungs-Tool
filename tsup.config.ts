import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      cli: 'src/cli.ts',
      server: 'src/server.ts',
      'http-adapter': 'src/http-adapter.ts',
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
  {
    // Browser / Next.js bundle. ESM only, React + React-DOM + @xyflow/react
    // stay external so hosts share a single React tree with the editor.
    entry: { preview: 'src/preview/index.ts' },
    format: ['esm'],
    target: 'es2022',
    platform: 'browser',
    dts: true,
    clean: false,
    minify: true,
    sourcemap: true,
    treeshake: true,
    external: ['react', 'react-dom', 'react-dom/client', '@xyflow/react'],
    loader: { '.css': 'css' },
    // Next.js App Router matches on a leading `'use client'` directive.
    // esbuild strips source-level directives during bundling AND tsup's
    // `banner` collides with minification, so prepend via a post-build
    // hook that just splices the literal bytes in front of the output.
    onSuccess: async () => {
      const { readFile, writeFile } = await import('node:fs/promises');
      const paths = ['dist/preview.js'];
      for (const p of paths) {
        try {
          const txt = await readFile(p, 'utf-8');
          if (!txt.startsWith("'use client'")) {
            await writeFile(p, `'use client';\n${txt}`, 'utf-8');
          }
        } catch {
          /* file may not exist on incremental builds */
        }
      }
    },
  },
]);
