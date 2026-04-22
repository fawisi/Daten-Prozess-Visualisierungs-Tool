import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import WebSocket from 'ws';
import { createHttpServer, startHttpServer } from './http-adapter.js';
import type { FastifyInstance } from 'fastify';

let tempDir: string;
let erdPath: string;
let bpmnPath: string;
const FIXTURES = resolve(__dirname, '../fixtures/erd-samples');

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'viso-http-test-'));
  erdPath = join(tempDir, 'schema.dbml');
  bpmnPath = join(tempDir, 'process.bpmn.json');
  // Seed with a valid BPMN file so GET returns non-empty data.
  await writeFile(
    bpmnPath,
    JSON.stringify(
      {
        format: 'viso-bpmn-v1',
        name: 'Sample',
        nodes: {
          start: { type: 'start-event', label: 'Start' },
          task1: { type: 'task', label: 'Do thing' },
          end: { type: 'end-event', label: 'End' },
        },
        flows: [
          { from: 'start', to: 'task1', label: null },
          { from: 'task1', to: 'end', label: null },
        ],
      },
      null,
      2
    ),
    'utf-8'
  );
  // Seed ERD with a minimal DBML file.
  await writeFile(
    erdPath,
    `Table users {\n  id uuid [pk]\n  email varchar [not null]\n}\n`,
    'utf-8'
  );
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
  delete process.env.VISO_ALLOWED_ORIGINS;
});

async function buildApp(options: Parameters<typeof createHttpServer>[0] = {}): Promise<FastifyInstance> {
  const app = await createHttpServer({
    erdFile: erdPath,
    bpmnFile: bpmnPath,
    quiet: true,
    ...options,
  });
  return app;
}

describe('HTTP adapter — health & discovery', () => {
  it('responds to GET /health with service metadata', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true, service: 'viso-mcp', version: '1.0.0' });
    } finally {
      await app.close();
    }
  });
});

describe('HTTP adapter — BPMN routes', () => {
  it('GET /api/workspace/:id/bpmn returns the loaded process', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/api/workspace/ws1/bpmn' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { ok: boolean; data: { nodes: Record<string, unknown> } };
      expect(body.ok).toBe(true);
      expect(Object.keys(body.data.nodes).sort()).toEqual(['end', 'start', 'task1']);
    } finally {
      await app.close();
    }
  });

  it('PUT /api/workspace/:id/bpmn with malformed JSON returns RFC 7807 problem+json', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/workspace/ws1/bpmn',
        headers: { 'content-type': 'application/json' },
        payload: { json: 'not-json' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      const body = res.json() as { type: string; title: string; status: number; detail: string };
      expect(body.type).toBe('https://viso-mcp.dev/problems/bpmn-parse-error');
      expect(body.title).toBe('BPMN JSON parse error');
      expect(body.status).toBe(400);
      expect(typeof body.detail).toBe('string');
    } finally {
      await app.close();
    }
  });

  it('PUT /api/workspace/:id/bpmn with invalid schema surfaces Zod issues', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/workspace/ws1/bpmn',
        headers: { 'content-type': 'application/json' },
        payload: {
          process: {
            format: 'viso-bpmn-v1',
            nodes: { bad: { type: 'unknown-type', label: 'Nope' } },
            flows: [],
          },
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      const body = res.json() as { type: string; errors: Array<{ path: string }> };
      expect(body.type).toBe('https://viso-mcp.dev/problems/bpmn-schema-invalid');
      expect(Array.isArray(body.errors)).toBe(true);
      expect(body.errors.length).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });

  it('POST /api/workspace/:id/bpmn/nodes creates a new node and persists it', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/workspace/ws1/bpmn/nodes',
        payload: { id: 'task2', type: 'task', label: 'Second task' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ ok: true, nodeId: 'task2' });

      const persisted = JSON.parse(await readFile(bpmnPath, 'utf-8'));
      expect(persisted.nodes.task2).toEqual({ type: 'task', label: 'Second task' });
    } finally {
      await app.close();
    }
  });

  it('POST /api/workspace/:id/bpmn/nodes rejects a duplicate start event with 409', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/workspace/ws1/bpmn/nodes',
        payload: { id: 'start2', type: 'start-event', label: 'Another start' },
      });
      expect(res.statusCode).toBe(409);
      const body = res.json() as { type: string };
      expect(body.type).toBe('https://viso-mcp.dev/problems/bpmn-duplicate-start');
    } finally {
      await app.close();
    }
  });

  it('DELETE /api/workspace/:id/bpmn/nodes/:nodeId cascades connected flows', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/workspace/ws1/bpmn/nodes/task1',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { cascadedFlows: number };
      expect(body.cascadedFlows).toBe(2);

      const persisted = JSON.parse(await readFile(bpmnPath, 'utf-8'));
      expect(persisted.nodes.task1).toBeUndefined();
      expect(persisted.flows).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it('GET /api/workspace/:id/bpmn/export?format=mermaid emits flowchart text', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/workspace/ws1/bpmn/export?format=mermaid',
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.body).toContain('flowchart LR');
      expect(res.body).toContain('start((');
    } finally {
      await app.close();
    }
  });
});

describe('HTTP adapter — ERD routes', () => {
  it('GET /api/workspace/:id/erd returns the parsed DBML diagram', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/api/workspace/ws1/erd' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { ok: boolean; data: { tables: Record<string, unknown> } };
      expect(body.ok).toBe(true);
      expect(Object.keys(body.data.tables)).toEqual(['users']);
    } finally {
      await app.close();
    }
  });

  it('PUT /api/workspace/:id/erd persists new DBML atomically', async () => {
    const app = await buildApp();
    try {
      const fixturePath = resolve(FIXTURES, 'simple.dbml');
      const dbml = await readFile(fixturePath, 'utf-8');
      const res = await app.inject({
        method: 'PUT',
        url: '/api/workspace/ws1/erd',
        payload: { dbml },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { ok: boolean; tableCount: number };
      expect(body.ok).toBe(true);
      expect(body.tableCount).toBeGreaterThan(0);

      const diskContent = await readFile(erdPath, 'utf-8');
      expect(diskContent).toBe(dbml.endsWith('\n') ? dbml : dbml + '\n');
    } finally {
      await app.close();
    }
  });

  it('PUT /api/workspace/:id/erd with parser error returns problem+json incl. diagnostics', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/workspace/ws1/erd',
        payload: { dbml: 'Table "??" {\n  id\n}' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      const body = res.json() as { type: string };
      expect(body.type).toBe('https://viso-mcp.dev/problems/dbml-parse-error');
    } finally {
      await app.close();
    }
  });

  it('GET /api/workspace/:id/erd/export?format=sql&dialect=postgres emits DDL', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/workspace/ws1/erd/export?format=sql&dialect=postgres',
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.body.toLowerCase()).toContain('create table');
    } finally {
      await app.close();
    }
  });

  it('GET /api/workspace/:id/erd/export?format=sql&dialect=mssql returns 400 problem+json', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/workspace/ws1/erd/export?format=sql&dialect=mssql',
      });
      expect(res.statusCode).toBe(400);
      const body = res.json() as { type: string };
      expect(body.type).toBe('https://viso-mcp.dev/problems/erd-sql-dialect');
    } finally {
      await app.close();
    }
  });
});

describe('HTTP adapter — CORS', () => {
  it('answers preflight for allowed origin with correct headers', async () => {
    const app = await buildApp({ allowedOrigins: ['http://localhost:3000'] });
    try {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/workspace/ws1/bpmn',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'PUT',
          'access-control-request-headers': 'content-type',
        },
      });
      expect(res.statusCode).toBeLessThan(300);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-methods']).toContain('PUT');
    } finally {
      await app.close();
    }
  });

  it('rejects preflight from a disallowed origin', async () => {
    const app = await buildApp({ allowedOrigins: ['http://localhost:3000'] });
    try {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/workspace/ws1/bpmn',
        headers: {
          origin: 'http://evil.example.com',
          'access-control-request-method': 'PUT',
        },
      });
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    } finally {
      await app.close();
    }
  });
});

describe('HTTP adapter — Authorization callback', () => {
  it('rejects requests without a valid bearer token via problem+json 401', async () => {
    const app = await buildApp({
      authValidator: (token) => token === 'secret-token',
    });
    try {
      const res = await app.inject({ method: 'GET', url: '/api/workspace/ws1/bpmn' });
      expect(res.statusCode).toBe(401);
      expect(res.headers['content-type']).toContain('application/problem+json');
      const body = res.json() as { type: string };
      expect(body.type).toBe('https://viso-mcp.dev/problems/auth-rejected');
    } finally {
      await app.close();
    }
  });

  it('accepts requests with the correct bearer token', async () => {
    const app = await buildApp({
      authValidator: (token, workspaceId) =>
        token === 'secret-token' && workspaceId === 'ws1',
    });
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/workspace/ws1/bpmn',
        headers: { authorization: 'Bearer secret-token' },
      });
      expect(res.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('does not run the auth validator on /health', async () => {
    let called = 0;
    const app = await buildApp({
      authValidator: () => {
        called += 1;
        return false;
      },
    });
    try {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      expect(called).toBe(0);
    } finally {
      await app.close();
    }
  });
});

describe('HTTP adapter — WebSocket events', () => {
  it('sends a hello message on connect and broadcasts schema-changed on file write', async () => {
    const app = await startHttpServer(
      0, // ephemeral port
      { erdFile: erdPath, bpmnFile: bpmnPath, quiet: true }
    );
    const address = app.server.address();
    if (!address || typeof address === 'string') {
      await app.close();
      throw new Error('Expected AddressInfo');
    }
    const url = `ws://127.0.0.1:${address.port}/api/workspace/ws1/events`;
    const messages: unknown[] = [];

    const ws = new WebSocket(url);
    await new Promise<void>((ready, fail) => {
      ws.once('open', ready);
      ws.once('error', fail);
    });

    // The hello arrives AFTER chokidar signals `ready`, so we can safely
    // hook the change listener before mutating the file.
    const gotHello = new Promise<void>((res) => {
      ws.once('message', (raw) => {
        messages.push(JSON.parse(raw.toString()));
        res();
      });
    });
    await gotHello;

    const gotChange = new Promise<void>((res) => {
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString()) as { type: string };
        if (msg.type === 'schema-changed') {
          messages.push(msg);
          res();
        }
      });
    });

    await writeFile(bpmnPath, await readFile(bpmnPath, 'utf-8') + '\n', 'utf-8');

    await Promise.race([
      gotChange,
      new Promise<void>((_, fail) => setTimeout(() => fail(new Error('no schema-changed event in 3s')), 3000)),
    ]);

    ws.close();
    await app.close();

    expect(messages[0]).toEqual({ type: 'hello', workspaceId: 'ws1' });
    expect(messages.some((m) => (m as { type: string }).type === 'schema-changed')).toBe(true);
  }, 10000);
});

describe('HTTP adapter — auth gate isolation', () => {
  it('keeps /health open while /api/workspace is gated', async () => {
    const app = await buildApp({
      authValidator: () => false, // reject everything
    });
    try {
      const healthRes = await app.inject({ method: 'GET', url: '/health' });
      expect(healthRes.statusCode).toBe(200);

      const wsRes = await app.inject({ method: 'GET', url: '/api/workspace/ws1/bpmn' });
      expect(wsRes.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it('forwards the workspace id to the auth validator for every route', async () => {
    const seen: Array<{ token: string | undefined; workspaceId: string }> = [];
    const app = await buildApp({
      authValidator: (token, workspaceId) => {
        seen.push({ token, workspaceId });
        return true;
      },
    });
    try {
      await app.inject({
        method: 'GET',
        url: '/api/workspace/ws-alpha/bpmn',
        headers: { authorization: 'Bearer tok-1' },
      });
      await app.inject({
        method: 'GET',
        url: '/api/workspace/ws-beta/erd',
        headers: { authorization: 'Bearer tok-2' },
      });
      expect(seen).toEqual([
        { token: 'tok-1', workspaceId: 'ws-alpha' },
        { token: 'tok-2', workspaceId: 'ws-beta' },
      ]);
    } finally {
      await app.close();
    }
  });
});

describe('HTTP adapter — body limits', () => {
  it('rejects DBML payloads above the DBML cap with a 413 problem+json', async () => {
    const app = await buildApp({ bodyLimit: 4 * 1024 * 1024 });
    try {
      // Build a DBML string over the 200 KiB cap but under the Fastify bodyLimit.
      const big = 'Table t {\n  id uuid [pk]\n}\n'.repeat(10_000);
      expect(big.length).toBeGreaterThan(200 * 1024);
      const res = await app.inject({
        method: 'PUT',
        url: '/api/workspace/ws1/erd',
        payload: { dbml: big },
      });
      expect(res.statusCode).toBe(413);
      const body = res.json() as { type: string };
      expect(body.type).toBe('https://viso-mcp.dev/problems/dbml-too-large');
    } finally {
      await app.close();
    }
  });
});
