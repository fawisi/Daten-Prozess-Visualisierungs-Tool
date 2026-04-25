import { createServer } from 'vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { visoPlugin } from './vite-plugin.js';

export async function startPreview(filePath: string) {
  const absPath = resolve(filePath);

  const server = await createServer({
    root: resolve(import.meta.dirname || __dirname, '.'),
    plugins: [
      react(),
      visoPlugin(absPath),
    ],
    server: {
      host: '127.0.0.1',
      port: 5555,
      open: true,
    },
  });

  await server.listen();
  server.printUrls();
}
