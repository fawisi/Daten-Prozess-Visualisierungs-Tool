import { defineConfig } from 'tsup';

export default defineConfig([
  {
    // Node entries: CLI + library exports share chunks so we don't
    // duplicate zod/Fastify/MCP-SDK across cli.cjs, server.cjs, and
    // http-adapter.cjs. The shebang is scoped to cli.* via a post-build
    // hook — a tsup `banner` would prepend `#!/usr/bin/env node` to
    // library ESM outputs too, which breaks programmatic imports in
    // bundlers that don't special-case the first-line directive.
    entry: {
      cli: 'src/cli.ts',
      server: 'src/server.ts',
      'http-adapter': 'src/http-adapter.ts',
      'export-mermaid': 'src/export/mermaid-cli.ts',
    },
    format: ['cjs', 'esm'],
    target: 'node20',
    dts: true,
    clean: true,
    onSuccess: async () => {
      const { readFile, writeFile } = await import('node:fs/promises');
      const shebang = '#!/usr/bin/env node\n';
      for (const p of ['dist/cli.cjs', 'dist/cli.js']) {
        try {
          const txt = await readFile(p, 'utf-8');
          if (!txt.startsWith('#!')) {
            await writeFile(p, `${shebang}${txt}`, 'utf-8');
          }
        } catch {
          /* incremental build may skip an entry */
        }
      }
    },
  },
  {
    // Browser / Next.js bundle. ESM only, React + React-DOM + @xyflow/react
    // stay external so hosts share a single React tree with the editor.
    // Sourcemaps are disabled for the published build: they would ship
    // ~6.5 MB of source to every consumer and leak internals via devtools.
    entry: { preview: 'src/preview/index.ts' },
    format: ['esm'],
    target: 'es2022',
    platform: 'browser',
    dts: true,
    clean: false,
    minify: true,
    sourcemap: false,
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
