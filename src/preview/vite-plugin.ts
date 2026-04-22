import type { Plugin, ViteDevServer } from 'vite';
import { watch } from 'chokidar';
import { WebSocketServer, WebSocket } from 'ws';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface VisoPluginOptions {
  erdFile: string;
  bpmnFile: string;
}

export function visoPlugin(
  erdFileOrOptions: string | VisoPluginOptions
): Plugin {
  const options: VisoPluginOptions =
    typeof erdFileOrOptions === 'string'
      ? { erdFile: erdFileOrOptions, bpmnFile: erdFileOrOptions.replace(/\.erd\.json$/, '.bpmn.json').replace(/^(.*)\/[^/]+$/, '$1/process.bpmn.json') }
      : erdFileOrOptions;

  const erdSchemaPath = resolve(options.erdFile);
  const erdPositionsPath = erdSchemaPath.replace(/\.erd\.json$/, '.erd.pos.json');
  const bpmnSchemaPath = resolve(options.bpmnFile);
  const bpmnPositionsPath = bpmnSchemaPath.replace(/\.bpmn\.json$/, '.bpmn.pos.json');

  let wss: WebSocketServer;

  function broadcast(msg: object) {
    const data = JSON.stringify(msg);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  return {
    name: 'viso',
    configureServer(server: ViteDevServer) {
      wss = new WebSocketServer({ noServer: true });

      if (!server.httpServer) return;

      server.httpServer.on('upgrade', (req, socket, head) => {
        if (req.url === '/__viso-ws') {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
        }
      });

      // File watchers
      let erdDebounce: ReturnType<typeof setTimeout> | null = null;
      const erdWatcher = watch(erdSchemaPath, { ignoreInitial: true });
      erdWatcher.on('change', () => {
        if (erdDebounce) clearTimeout(erdDebounce);
        erdDebounce = setTimeout(() => {
          broadcast({ type: 'schema-changed', diagramType: 'erd' });
        }, 300);
      });

      let bpmnDebounce: ReturnType<typeof setTimeout> | null = null;
      const bpmnWatcher = watch(bpmnSchemaPath, { ignoreInitial: true });
      bpmnWatcher.on('change', () => {
        if (bpmnDebounce) clearTimeout(bpmnDebounce);
        bpmnDebounce = setTimeout(() => {
          broadcast({ type: 'schema-changed', diagramType: 'bpmn' });
        }, 300);
      });

      // API routes
      server.middlewares.use(async (req, res, next) => {
        // === ERD Routes ===
        if (req.url === '/__viso-api/schema' && req.method === 'GET') {
          return serveFile(res, erdSchemaPath, {
            format: 'viso-erd-v1',
            tables: {},
            relations: [],
          });
        }

        if (req.url === '/__viso-api/positions') {
          if (req.method === 'GET') {
            return serveFile(res, erdPositionsPath, {});
          }
          if (req.method === 'PUT') {
            return writeJsonBody(req, res, erdPositionsPath);
          }
        }

        // Raw ERD source (for Code Panel)
        if (req.url === '/__viso-api/source') {
          if (req.method === 'GET') {
            return serveRaw(res, erdSchemaPath, '{}');
          }
          if (req.method === 'PUT') {
            return writeRawBody(req, res, erdSchemaPath);
          }
        }

        // === BPMN Routes ===
        if (req.url === '/__viso-api/bpmn/schema' && req.method === 'GET') {
          return serveFile(res, bpmnSchemaPath, {
            format: 'viso-bpmn-v1',
            nodes: {},
            flows: [],
          });
        }

        if (req.url === '/__viso-api/bpmn/positions') {
          if (req.method === 'GET') {
            return serveFile(res, bpmnPositionsPath, {});
          }
          if (req.method === 'PUT') {
            return writeJsonBody(req, res, bpmnPositionsPath);
          }
        }

        // Raw BPMN source (for Code Panel)
        if (req.url === '/__viso-api/bpmn/source') {
          if (req.method === 'GET') {
            return serveRaw(res, bpmnSchemaPath, '{}');
          }
          if (req.method === 'PUT') {
            return writeRawBody(req, res, bpmnSchemaPath);
          }
        }

        // === Files listing ===
        if (req.url === '/__viso-api/files' && req.method === 'GET') {
          const files = [];

          // Check if ERD file exists
          try {
            await readFile(erdSchemaPath, 'utf-8');
            const name = erdSchemaPath.split('/').pop()?.replace('.erd.json', '') ?? 'schema';
            files.push({ name: name + '.erd', path: erdSchemaPath.split('/').pop(), type: 'erd' });
          } catch {}

          // Check if BPMN file exists
          try {
            await readFile(bpmnSchemaPath, 'utf-8');
            const name = bpmnSchemaPath.split('/').pop()?.replace('.bpmn.json', '') ?? 'process';
            files.push({ name: name + '.bpmn', path: bpmnSchemaPath.split('/').pop(), type: 'bpmn' });
          } catch {}

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(files));
          return;
        }

        next();
      });
    },
  };
}

async function serveFile(
  res: import('http').ServerResponse,
  path: string,
  fallback: object
) {
  try {
    const data = await readFile(path, 'utf-8');
    res.setHeader('Content-Type', 'application/json');
    res.end(data);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(fallback));
    } else {
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }
}

function writeJsonBody(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  path: string
) {
  let body = '';
  req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
  req.on('end', async () => {
    try {
      JSON.parse(body); // Validate JSON
      await writeFile(path, body, 'utf-8');
      res.statusCode = 200;
      res.end('OK');
    } catch {
      res.statusCode = 400;
      res.end('Invalid JSON');
    }
  });
}

async function serveRaw(
  res: import('http').ServerResponse,
  path: string,
  fallback: string
) {
  try {
    const data = await readFile(path, 'utf-8');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(data);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(fallback);
    } else {
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }
}

function writeRawBody(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  path: string
) {
  let body = '';
  req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
  req.on('end', async () => {
    try {
      await writeFile(path, body, 'utf-8');
      res.statusCode = 200;
      res.end('OK');
    } catch {
      res.statusCode = 500;
      res.end('Write failed');
    }
  });
}
