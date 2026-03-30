import type { Plugin, ViteDevServer } from 'vite';
import { watch } from 'chokidar';
import { WebSocketServer, WebSocket } from 'ws';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

export function datenVizPlugin(erdFilePath: string): Plugin {
  const schemaPath = resolve(erdFilePath);
  const positionsPath = schemaPath.replace(/\.erd\.json$/, '.erd.pos.json');
  let wss: WebSocketServer;

  return {
    name: 'daten-viz',
    configureServer(server: ViteDevServer) {
      // WebSocket server on a subpath
      wss = new WebSocketServer({ noServer: true });

      if (!server.httpServer) return;

      server.httpServer.on('upgrade', (req, socket, head) => {
        if (req.url === '/__daten-viz-ws') {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
        }
      });

      // File watcher — only watch .erd.json (schema), NOT .erd.pos.json
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      const watcher = watch(schemaPath, { ignoreInitial: true });
      watcher.on('change', () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const msg = JSON.stringify({ type: 'schema-changed' });
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(msg);
            }
          });
        }, 300);
      });

      // API routes for schema and positions
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/__daten-viz-api/schema' && req.method === 'GET') {
          try {
            const data = await readFile(schemaPath, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(data);
          } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                format: 'daten-viz-erd-v1',
                tables: {},
                relations: [],
              }));
            } else {
              res.statusCode = 500;
              res.end('Internal Server Error');
            }
          }
          return;
        }

        if (req.url === '/__daten-viz-api/positions') {
          if (req.method === 'GET') {
            try {
              const data = await readFile(positionsPath, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(data);
            } catch (err: unknown) {
              if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
                res.setHeader('Content-Type', 'application/json');
                res.end('{}');
              } else {
                res.statusCode = 500;
                res.end('Internal Server Error');
              }
            }
            return;
          }

          if (req.method === 'PUT') {
            let body = '';
            req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
            req.on('end', async () => {
              try {
                JSON.parse(body); // Validate JSON
                await writeFile(positionsPath, body, 'utf-8');
                res.statusCode = 200;
                res.end('OK');
              } catch {
                res.statusCode = 400;
                res.end('Invalid JSON');
              }
            });
            return;
          }
        }

        next();
      });
    },
  };
}
