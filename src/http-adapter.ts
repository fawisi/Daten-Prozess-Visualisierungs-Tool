import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import { watch, type FSWatcher } from 'chokidar';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { writeFile, rename, realpath } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Parser, exporter } from '@dbml/core';
import { DbmlStore, diagramToDbml, rawDatabaseToDiagram } from './dbml-store.js';
import { ProcessStore } from './bpmn/store.js';
import { DiagramSchema } from './schema.js';
import { ProcessSchema } from './bpmn/schema.js';
import { loadModeSidecar, saveModeSidecar } from './mode-sidecar.js';
import { inferProcessMode, bpmnOnlyNodeIds } from './bpmn/mode-heuristic.js';
import { z } from 'zod';

const ModeRequestSchema = z.object({
  mode: z.enum(['simple', 'bpmn']),
});
import { toMermaid } from './export/mermaid.js';
import { processToMermaid } from './bpmn/export-mermaid.js';
import { derivePositionsPath, prunePositions } from './positions.js';
import type { Diagram } from './schema.js';
import type { Process, ProcessNodeType_, GatewayType_ } from './bpmn/schema.js';

/**
 * Resolves a workspace id to on-disk paths for DBML + BPMN sources.
 *
 * In single-workspace (default) mode, the resolver returns the same
 * pair regardless of id — matching the MCP stdio server behaviour.
 * Multi-workspace embeddings (e.g. TAFKA KI-Hub) pass a custom
 * resolver that maps the id to per-workspace storage.
 */
export type WorkspaceResolver = (
  workspaceId: string
) => { erdPath: string; bpmnPath: string } | Promise<{ erdPath: string; bpmnPath: string }>;

/**
 * Pass-through validator the hub owns. viso-mcp never learns secrets.
 * Return `true` to accept, `false` to reject with 401. If omitted, every
 * request is allowed (useful for localhost smoke tests — production hubs
 * MUST provide one).
 */
export type AuthValidator = (
  token: string | undefined,
  workspaceId: string
) => boolean | Promise<boolean>;

export interface HttpAdapterOptions {
  /** Fallback workspace paths if no resolver is provided. */
  erdFile?: string;
  bpmnFile?: string;
  workspaceResolver?: WorkspaceResolver;
  authValidator?: AuthValidator;
  /** CORS allow-list; default: `http://localhost:3000,http://localhost:3001`. */
  allowedOrigins?: string[];
  /** Request body size limit in bytes. Default 256 KiB. */
  bodyLimit?: number;
  /** When true, `fastify` boot logs are silenced (tests, production hubs). */
  quiet?: boolean;
}

const PROBLEM_BASE = 'https://viso-mcp.dev/problems';

interface ProblemBody {
  type: string;
  title: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: unknown[];
  [key: string]: unknown;
}

function problem(reply: FastifyReply, status: number, body: Omit<ProblemBody, 'status'>) {
  reply
    .status(status)
    .header('content-type', 'application/problem+json')
    .send({ ...body, status });
}

function defaultResolver(erdFile: string, bpmnFile: string): WorkspaceResolver {
  const erdPath = resolve(erdFile);
  const bpmnPath = resolve(bpmnFile);
  return () => ({ erdPath, bpmnPath });
}

function parseAllowedOrigins(env: string | undefined, override?: string[]): string[] {
  if (override) return override;
  const raw = env ?? 'http://localhost:3000,http://localhost:3001';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Cap request bodies to 256 KiB. DBML files that exceed this are rejected
 *  before the parser runs, killing an obvious DoS vector (unbounded nested
 *  grammar on a multi-MiB input). Hubs with legitimate large schemas can
 *  raise via {@link HttpAdapterOptions.bodyLimit}. */
const DEFAULT_BODY_LIMIT = 256 * 1024;

/** Cap DBML source strings before feeding them to the @dbml/core parser.
 *  The parser is recursive-descent; deeply nested inputs at the body
 *  limit still eat event-loop time. 200 KiB is an order of magnitude more
 *  than a realistic human-edited schema. */
const DBML_INPUT_LIMIT = 200 * 1024;

export async function createHttpServer(
  options: HttpAdapterOptions = {}
): Promise<FastifyInstance> {
  const erdFile = options.erdFile ?? './schema.dbml';
  const bpmnFile = options.bpmnFile ?? './process.bpmn.json';
  const resolver = options.workspaceResolver ?? defaultResolver(erdFile, bpmnFile);
  const allowedOrigins = parseAllowedOrigins(process.env.VISO_ALLOWED_ORIGINS, options.allowedOrigins);

  const app = Fastify({
    bodyLimit: options.bodyLimit ?? DEFAULT_BODY_LIMIT,
    logger: options.quiet
      ? false
      : {
          level: 'info',
          transport: undefined,
        },
  });

  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      // No origin (curl, same-origin, server-side fetch) — accept.
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.register(fastifyWebsocket);

  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    // Auth gate only runs on workspace routes — health/meta endpoints are open.
    if (!req.url.startsWith('/api/workspace/')) return;
    if (!options.authValidator) return;

    const token = readBearerToken(req.headers.authorization);
    const workspaceId = (req.params as Record<string, string> | undefined)?.workspaceId
      ?? extractWorkspaceIdFromUrl(req.url);

    if (!workspaceId) {
      problem(reply, 400, {
        type: `${PROBLEM_BASE}/missing-workspace-id`,
        title: 'Missing workspace id',
        detail: 'Every /api/workspace/:workspaceId/* route must include a workspace id.',
      });
      return reply;
    }

    const ok = await options.authValidator(token, workspaceId);
    if (!ok) {
      problem(reply, 401, {
        type: `${PROBLEM_BASE}/auth-rejected`,
        title: 'Authorization rejected',
        detail: 'The supplied bearer token was not accepted for this workspace.',
      });
      return reply;
    }
  });

  app.get('/health', async () => ({ ok: true, service: 'viso-mcp', version: '1.0.0' }));

  await registerBpmnRoutes(app, resolver);
  await registerErdRoutes(app, resolver);
  await registerEventsRoute(app, resolver);

  app.setErrorHandler((err, req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    app.log.error({ err, url: req.url }, 'unhandled error');
    // 4xx echoes the message back so clients can fix their input; 5xx is
    // generic so filesystem paths, stack traces, and internal state don't
    // leak to the hub's browser tab.
    const detail = status >= 500
      ? 'The server could not complete this request. Check server logs for details.'
      : err.message;
    problem(reply, status, {
      type: `${PROBLEM_BASE}/internal`,
      title: err.name || (status >= 500 ? 'Internal Server Error' : 'Bad Request'),
      detail,
    });
  });

  return app;
}

function readBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) return undefined;
  return value;
}

function extractWorkspaceIdFromUrl(url: string): string | undefined {
  // `/api/workspace/<id>/...` — second segment after workspace.
  const match = /\/api\/workspace\/([^/?#]+)/.exec(url);
  return match?.[1];
}

// ========================================================================
// BPMN routes
// ========================================================================

async function registerBpmnRoutes(app: FastifyInstance, resolver: WorkspaceResolver) {
  app.get('/api/workspace/:workspaceId/bpmn', async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const { bpmnPath } = await resolver(workspaceId);
    try {
      const store = new ProcessStore(bpmnPath);
      const process = await store.load();
      return { ok: true, data: process };
    } catch (err) {
      app.log.error({ err, workspaceId }, 'BPMN load failed');
      problem(reply, 500, {
        type: `${PROBLEM_BASE}/bpmn-load-failed`,
        title: 'BPMN load failed',
        detail: 'Could not read the BPMN document for this workspace. Check server logs.',
      });
      return reply;
    }
  });

  app.get('/api/workspace/:workspaceId/bpmn/mode', async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const { bpmnPath } = await resolver(workspaceId);
    try {
      const store = new ProcessStore(bpmnPath);
      const sidecar = await loadModeSidecar(bpmnPath);
      if (sidecar?.kind === 'bpmn') {
        return { ok: true, mode: sidecar.mode, source: 'sidecar' as const };
      }
      // Heuristic-fallback for v1.0 files: if the schema contains BPMN-only
      // elements, default to 'bpmn' mode (compat); otherwise 'simple'.
      const process = await store.load();
      return {
        ok: true,
        mode: inferProcessMode(process),
        source: 'heuristic' as const,
      };
    } catch (err) {
      app.log.error({ err, workspaceId }, 'BPMN mode load failed');
      problem(reply, 500, {
        type: `${PROBLEM_BASE}/bpmn-mode-load-failed`,
        title: 'BPMN mode sidecar load failed',
        detail: (err as Error).message,
      });
      return reply;
    }
  });

  app.put('/api/workspace/:workspaceId/bpmn/mode', async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    // Parse-first-then-act: never trust the wire. Zod-narrowing beats
    // the ad-hoc `as { mode?: string }` cast that would let an invalid
    // string sneak through (kieran-review P1 N2).
    const parsed = ModeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      problem(reply, 400, {
        type: `${PROBLEM_BASE}/bpmn-mode-invalid`,
        title: 'Invalid mode',
        detail: "Expected { mode: 'simple' | 'bpmn' } in request body.",
      });
      return reply;
    }
    const { bpmnPath } = await resolver(workspaceId);
    await saveModeSidecar(bpmnPath, {
      kind: 'bpmn',
      mode: parsed.data.mode,
      version: '1.1',
    });
    return { ok: true, mode: parsed.data.mode };
  });

  // Hidden-element count — used by the PropertiesPanel to surface
  // "N BPMN-only elements are hidden" when in simple mode.
  app.get('/api/workspace/:workspaceId/bpmn/hidden-elements', async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const { bpmnPath } = await resolver(workspaceId);
    try {
      const store = new ProcessStore(bpmnPath);
      const process = await store.load();
      return { ok: true, hiddenIds: bpmnOnlyNodeIds(process) };
    } catch (err) {
      app.log.error({ err, workspaceId }, 'BPMN hidden-elements failed');
      problem(reply, 500, {
        type: `${PROBLEM_BASE}/bpmn-hidden-elements-failed`,
        title: 'Could not compute hidden elements',
        detail: (err as Error).message,
      });
      return reply;
    }
  });

  app.put('/api/workspace/:workspaceId/bpmn', async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const body = req.body as { json?: string; process?: unknown };

    let parsed: unknown;
    if (typeof body?.json === 'string') {
      try {
        parsed = JSON.parse(body.json);
      } catch (err) {
        problem(reply, 400, {
          type: `${PROBLEM_BASE}/bpmn-parse-error`,
          title: 'BPMN JSON parse error',
          detail: (err as Error).message,
        });
        return reply;
      }
    } else if (body?.process !== undefined) {
      parsed = body.process;
    } else {
      problem(reply, 400, {
        type: `${PROBLEM_BASE}/bpmn-missing-body`,
        title: 'Missing request body',
        detail: 'Expected JSON body with either `json` (string) or `process` (object) fields.',
      });
      return reply;
    }

    const validated = ProcessSchema.safeParse(parsed);
    if (!validated.success) {
      problem(reply, 400, {
        type: `${PROBLEM_BASE}/bpmn-schema-invalid`,
        title: 'BPMN failed schema validation',
        detail: 'Zod validation failed — see errors[] for details.',
        errors: validated.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      });
      return reply;
    }

    const { bpmnPath } = await resolver(workspaceId);
    const store = new ProcessStore(bpmnPath);
    await store.save(validated.data);

    const validIds = new Set(Object.keys(validated.data.nodes));
    const prunedPositions = await prunePositions(derivePositionsPath(bpmnPath), validIds);

    return {
      ok: true,
      nodeCount: Object.keys(validated.data.nodes).length,
      flowCount: validated.data.flows.length,
      prunedPositions,
    };
  });

  app.post('/api/workspace/:workspaceId/bpmn/nodes', async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const body = req.body as {
      id?: string;
      type?: ProcessNodeType_;
      label?: string;
      description?: string;
      gatewayType?: GatewayType_;
    };

    if (!body?.id || !body?.type || typeof body.label !== 'string') {
      problem(reply, 400, {
        type: `${PROBLEM_BASE}/bpmn-add-node-invalid`,
        title: 'Invalid add-node payload',
        detail: 'Body must contain { id, type, label }. Optional: description, gatewayType.',
      });
      return reply;
    }

    const { bpmnPath } = await resolver(workspaceId);
    const store = new ProcessStore(bpmnPath);
    const processDoc = await store.load();

    if (processDoc.nodes[body.id]) {
      problem(reply, 409, {
        type: `${PROBLEM_BASE}/bpmn-node-exists`,
        title: 'Node already exists',
        detail: `Node "${body.id}" already exists. Delete it first or choose a different id.`,
      });
      return reply;
    }

    if (body.type === 'start-event') {
      const existing = Object.entries(processDoc.nodes).find(([, n]) => n.type === 'start-event');
      if (existing) {
        problem(reply, 409, {
          type: `${PROBLEM_BASE}/bpmn-duplicate-start`,
          title: 'Duplicate start event',
          detail: `Process already has a start event ("${existing[0]}"). Only one is allowed.`,
        });
        return reply;
      }
    }

    processDoc.nodes[body.id] = {
      type: body.type,
      label: body.label,
      ...(body.description ? { description: body.description } : {}),
      ...(body.type === 'gateway'
        ? { gatewayType: body.gatewayType ?? 'exclusive' }
        : {}),
    };
    await store.save(processDoc);
    reply.status(201);
    return { ok: true, nodeId: body.id, nodeCount: Object.keys(processDoc.nodes).length };
  });

  app.delete('/api/workspace/:workspaceId/bpmn/nodes/:nodeId', async (req, reply) => {
    const { workspaceId, nodeId } = req.params as { workspaceId: string; nodeId: string };
    const { bpmnPath } = await resolver(workspaceId);
    const store = new ProcessStore(bpmnPath);
    const processDoc = await store.load();

    if (!processDoc.nodes[nodeId]) {
      problem(reply, 404, {
        type: `${PROBLEM_BASE}/bpmn-node-not-found`,
        title: 'Node not found',
        detail: `Node "${nodeId}" does not exist in this workspace.`,
      });
      return reply;
    }

    delete processDoc.nodes[nodeId];
    const before = processDoc.flows.length;
    processDoc.flows = processDoc.flows.filter((f) => f.from !== nodeId && f.to !== nodeId);
    await store.save(processDoc);
    return {
      ok: true,
      removed: nodeId,
      cascadedFlows: before - processDoc.flows.length,
    };
  });

  app.post('/api/workspace/:workspaceId/bpmn/flows', async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const body = req.body as { from?: string; to?: string; label?: string | null };

    if (!body?.from || !body?.to) {
      problem(reply, 400, {
        type: `${PROBLEM_BASE}/bpmn-add-flow-invalid`,
        title: 'Invalid add-flow payload',
        detail: 'Body must contain { from, to }. Optional: label.',
      });
      return reply;
    }

    const { bpmnPath } = await resolver(workspaceId);
    const store = new ProcessStore(bpmnPath);
    const processDoc = await store.load();

    if (!processDoc.nodes[body.from]) {
      problem(reply, 404, {
        type: `${PROBLEM_BASE}/bpmn-flow-source-missing`,
        title: 'Flow source not found',
        detail: `Node "${body.from}" does not exist — create it before adding the flow.`,
      });
      return reply;
    }
    if (!processDoc.nodes[body.to]) {
      problem(reply, 404, {
        type: `${PROBLEM_BASE}/bpmn-flow-target-missing`,
        title: 'Flow target not found',
        detail: `Node "${body.to}" does not exist — create it before adding the flow.`,
      });
      return reply;
    }
    if (processDoc.flows.some((f) => f.from === body.from && f.to === body.to)) {
      problem(reply, 409, {
        type: `${PROBLEM_BASE}/bpmn-flow-exists`,
        title: 'Flow already exists',
        detail: `A flow from "${body.from}" to "${body.to}" is already defined.`,
      });
      return reply;
    }

    processDoc.flows.push({ from: body.from, to: body.to, label: body.label ?? null });
    await store.save(processDoc);
    reply.status(201);
    return { ok: true, flowCount: processDoc.flows.length };
  });

  app.delete('/api/workspace/:workspaceId/bpmn/flows', async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to) {
      problem(reply, 400, {
        type: `${PROBLEM_BASE}/bpmn-remove-flow-invalid`,
        title: 'Invalid remove-flow query',
        detail: 'Provide ?from=<id>&to=<id> query parameters.',
      });
      return reply;
    }

    const { bpmnPath } = await resolver(workspaceId);
    const store = new ProcessStore(bpmnPath);
    const processDoc = await store.load();
    const before = processDoc.flows.length;
    processDoc.flows = processDoc.flows.filter((f) => !(f.from === from && f.to === to));
    const removed = before - processDoc.flows.length;
    if (removed === 0) {
      problem(reply, 404, {
        type: `${PROBLEM_BASE}/bpmn-flow-not-found`,
        title: 'Flow not found',
        detail: `No flow from "${from}" to "${to}".`,
      });
      return reply;
    }
    await store.save(processDoc);
    return { ok: true, removed };
  });

  app.get('/api/workspace/:workspaceId/bpmn/export', async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const { format, theme } = req.query as { format?: string; theme?: string };
    const fmt = (format ?? 'json').toLowerCase();
    const themeOpt = theme === 'light' || theme === 'dark' ? theme : undefined;

    const { bpmnPath } = await resolver(workspaceId);
    const store = new ProcessStore(bpmnPath);
    const processDoc = await store.load();

    if (fmt === 'json') {
      reply.header('content-type', 'application/json');
      return processDoc;
    }
    if (fmt === 'mermaid') {
      reply.header('content-type', 'text/plain; charset=utf-8');
      return processToMermaid(processDoc, themeOpt ? { theme: themeOpt } : {});
    }
    problem(reply, 400, {
      type: `${PROBLEM_BASE}/bpmn-export-format`,
      title: 'Unsupported export format',
      detail: `Format "${format}" is not supported for BPMN. Known: json, mermaid. Optional: theme=light|dark.`,
    });
    return reply;
  });
}

// ========================================================================
// ERD routes
// ========================================================================

async function registerErdRoutes(app: FastifyInstance, resolver: WorkspaceResolver) {
  app.get('/api/workspace/:workspaceId/erd', async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const { erdPath } = await resolver(workspaceId);
    try {
      const store = new DbmlStore(erdPath);
      const diagram = await store.load();
      return { ok: true, data: diagram };
    } catch (err) {
      app.log.error({ err, workspaceId }, 'ERD load failed');
      problem(reply, 500, {
        type: `${PROBLEM_BASE}/erd-load-failed`,
        title: 'ERD load failed',
        detail: 'Could not read the ERD document for this workspace. Check server logs.',
      });
      return reply;
    }
  });

  app.put('/api/workspace/:workspaceId/erd', async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const body = req.body as { dbml?: string };
    if (typeof body?.dbml !== 'string' || body.dbml.length === 0) {
      problem(reply, 400, {
        type: `${PROBLEM_BASE}/erd-missing-body`,
        title: 'Missing DBML payload',
        detail: 'Expected JSON body with `dbml` (string) field holding the complete DBML document.',
      });
      return reply;
    }
    if (body.dbml.length > DBML_INPUT_LIMIT) {
      problem(reply, 413, {
        type: `${PROBLEM_BASE}/dbml-too-large`,
        title: 'DBML document too large',
        detail: `DBML payload is ${body.dbml.length} bytes; the server caps inputs at ${DBML_INPUT_LIMIT} bytes to protect the parser.`,
      });
      return reply;
    }

    let parsedRaw: unknown;
    try {
      parsedRaw = Parser.parseDBMLToJSONv2(body.dbml);
    } catch (err) {
      problem(reply, 400, {
        type: `${PROBLEM_BASE}/dbml-parse-error`,
        title: 'DBML parse error',
        detail: (err as Error).message,
        errors: extractDbmlDiagnostics(err),
      });
      return reply;
    }

    let diagram: Diagram;
    try {
      // Safe cast: the result is validated via DiagramSchema.safeParse below;
      // any shape mismatch turns into a 400 with Zod issues.
      diagram = rawDatabaseToDiagram(parsedRaw as Parameters<typeof rawDatabaseToDiagram>[0]);
    } catch (err) {
      problem(reply, 400, {
        type: `${PROBLEM_BASE}/dbml-reconstruct-failed`,
        title: 'DBML parsed but failed internal mapping',
        detail: (err as Error).message,
      });
      return reply;
    }

    const check = DiagramSchema.safeParse(diagram);
    if (!check.success) {
      problem(reply, 400, {
        type: `${PROBLEM_BASE}/dbml-schema-invalid`,
        title: 'DBML parsed but failed internal schema validation',
        detail: 'Reserved identifier or unsupported table/column shape.',
        errors: check.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      });
      return reply;
    }

    const { erdPath } = await resolver(workspaceId);
    // Preserve raw DBML text so features our internal Diagram cannot
    // represent (indexes, enums, TableGroups) survive the round-trip.
    const dir = dirname(erdPath);
    const tmp = join(dir, `.tmp-${randomUUID()}.dbml`);
    const payload = body.dbml.endsWith('\n') ? body.dbml : body.dbml + '\n';
    await writeFile(tmp, payload, 'utf-8');
    await rename(tmp, erdPath);

    const validTableIds = new Set(Object.keys(check.data.tables));
    const prunedPositions = await prunePositions(derivePositionsPath(erdPath), validTableIds);

    return {
      ok: true,
      tableCount: Object.keys(check.data.tables).length,
      relationCount: check.data.relations.length,
      prunedPositions,
    };
  });

  app.get('/api/workspace/:workspaceId/erd/export', async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const { format, dialect, theme } = req.query as {
      format?: string;
      dialect?: string;
      theme?: string;
    };
    const fmt = (format ?? 'dbml').toLowerCase();
    const themeOpt = theme === 'light' || theme === 'dark' ? theme : undefined;

    const { erdPath } = await resolver(workspaceId);
    const store = new DbmlStore(erdPath);
    const diagram = await store.load();

    if (fmt === 'dbml') {
      reply.header('content-type', 'text/plain; charset=utf-8');
      return diagramToDbml(diagram);
    }
    if (fmt === 'mermaid') {
      reply.header('content-type', 'text/plain; charset=utf-8');
      return toMermaid(diagram, themeOpt ? { theme: themeOpt } : {});
    }
    if (fmt === 'sql') {
      const d = (dialect ?? 'postgres').toLowerCase();
      if (d !== 'postgres' && d !== 'mysql') {
        problem(reply, 400, {
          type: `${PROBLEM_BASE}/erd-sql-dialect`,
          title: 'Unsupported SQL dialect',
          detail: `Dialect "${dialect}" not supported. Known: postgres, mysql (mssql/oracle/snowflake ship in v1.1).`,
        });
        return reply;
      }
      try {
        const sql = exporter.export(diagramToDbml(diagram), d);
        reply.header('content-type', 'text/plain; charset=utf-8');
        return sql;
      } catch (err) {
        app.log.error({ err, workspaceId, dialect: d }, 'SQL export failed');
        problem(reply, 500, {
          type: `${PROBLEM_BASE}/erd-sql-export-failed`,
          title: 'SQL export failed',
          detail: 'The DBML exporter could not render this schema. Check server logs.',
        });
        return reply;
      }
    }
    if (fmt === 'json') {
      reply.header('content-type', 'application/json');
      return diagram;
    }
    problem(reply, 400, {
      type: `${PROBLEM_BASE}/erd-export-format`,
      title: 'Unsupported export format',
      detail: `Format "${format}" is not supported for ERD. Known: dbml, mermaid, sql (+dialect), json.`,
    });
    return reply;
  });
}

// ========================================================================
// Events route — WebSocket push on file changes
// ========================================================================

async function registerEventsRoute(app: FastifyInstance, resolver: WorkspaceResolver) {
  // Track per-workspace watchers so we don't spin up a new chokidar
  // listener per client connection.
  const watchers = new Map<
    string,
    { watcher: FSWatcher; clients: Set<(msg: string) => void>; bpmnPath: string; erdPath: string }
  >();

  async function ensureWatcher(workspaceId: string) {
    const existing = watchers.get(workspaceId);
    if (existing) return existing;

    const { erdPath, bpmnPath } = await resolver(workspaceId);
    // macOS resolves /tmp and /var/folders through /private/..., so chokidar
    // emits real paths while the resolver returns the logical ones. Compare
    // on real paths so file-change events actually match either source.
    const realErd = await safeRealpath(erdPath);
    const realBpmn = await safeRealpath(bpmnPath);
    const watcher = watch([erdPath, bpmnPath], { ignoreInitial: true });
    const clients = new Set<(msg: string) => void>();
    let ready = false;
    const readyPromise = new Promise<void>((resolve) => {
      watcher.once('ready', () => {
        ready = true;
        resolve();
      });
    });

    const broadcast = (event: Record<string, unknown>) => {
      const payload = JSON.stringify(event);
      for (const send of clients) send(payload);
    };

    watcher.on('change', (p) => {
      const normalized = p;
      if (normalized === bpmnPath || normalized === realBpmn) {
        broadcast({ type: 'schema-changed', diagramType: 'bpmn' });
      } else if (normalized === erdPath || normalized === realErd) {
        broadcast({ type: 'schema-changed', diagramType: 'erd' });
      }
    });

    const entry = { watcher, clients, bpmnPath, erdPath, ready: () => readyPromise, isReady: () => ready };
    watchers.set(workspaceId, entry);
    return entry;
  }

  app.get('/api/workspace/:workspaceId/events', { websocket: true }, async (socket, req) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const entry = await ensureWatcher(workspaceId);

    const send = (msg: string) => {
      try {
        socket.send(msg);
      } catch {
        /* client gone */
      }
    };
    entry.clients.add(send);
    // Wait for chokidar's initial scan so the hello message and the first
    // `schema-changed` broadcast are separated by a deterministic boundary.
    await entry.ready();
    send(JSON.stringify({ type: 'hello', workspaceId }));

    socket.on('close', () => {
      entry.clients.delete(send);
      // Release the inotify handle once the last client disconnects so a
      // hub watching many workspaces doesn't slow-leak descriptors.
      if (entry.clients.size === 0) {
        watchers.delete(workspaceId);
        entry.watcher.close().catch(() => {
          /* already closed or never opened */
        });
      }
    });
  });

  app.addHook('onClose', async () => {
    await Promise.all(
      Array.from(watchers.values()).map((entry) => entry.watcher.close().catch(() => undefined))
    );
    watchers.clear();
  });
}

async function safeRealpath(p: string): Promise<string> {
  try {
    return await realpath(p);
  } catch {
    // File doesn't exist yet — fall back to logical path; once it does
    // exist, chokidar will emit the real path and the logical comparison
    // below will miss, but callers typically seed files before watching.
    return p;
  }
}

function extractDbmlDiagnostics(err: unknown): unknown[] {
  const diags = (err as { diags?: unknown[] })?.diags;
  if (!Array.isArray(diags)) return [];
  return diags.map((d) => {
    const diag = d as Record<string, unknown>;
    return {
      message: (diag.message as string | undefined) ?? (diag.msg as string | undefined),
      code: diag.code,
      start: diag.start,
      end: diag.end,
    };
  });
}

/**
 * Start the HTTP adapter on the given port. Returns the Fastify instance
 * so callers can close it in tests. `host` defaults to `127.0.0.1` —
 * hubs should expose on `0.0.0.0` explicitly if they bind a public port.
 */
export async function startHttpServer(
  port: number,
  options: HttpAdapterOptions = {},
  host = '127.0.0.1'
): Promise<FastifyInstance> {
  const app = await createHttpServer(options);
  await app.listen({ port, host });
  return app;
}
