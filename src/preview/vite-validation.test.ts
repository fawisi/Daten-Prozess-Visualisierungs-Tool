import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { writeValidatedRawBody } from './vite-validation.js';
import { DiagramSchema } from '../schema.js';

const PROBLEM_BASE = 'https://viso-mcp.dev/problems/test';

/**
 * Build a minimal request stub that emits the given body as a single
 * 'data' chunk followed by 'end'. Adequate for vite-validation which
 * only listens for 'data' / 'end' / 'error'.
 */
function makeRequest(body: string): IncomingMessage {
  return Readable.from([Buffer.from(body, 'utf-8')]) as unknown as IncomingMessage;
}

interface ResponseStub {
  res: ServerResponse;
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  ended: boolean;
}

function makeResponse(): ResponseStub {
  const stub = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: '',
    ended: false,
  };
  const res = {
    get statusCode() {
      return stub.statusCode;
    },
    set statusCode(v: number) {
      stub.statusCode = v;
    },
    setHeader(name: string, value: string) {
      stub.headers[name.toLowerCase()] = value;
    },
    end(chunk?: string) {
      if (chunk !== undefined) stub.body += chunk;
      stub.ended = true;
    },
  } as unknown as ServerResponse;
  return Object.assign(stub, { res });
}

describe('writeValidatedRawBody', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'viso-validation-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('rejects invalid JSON with 400 + RFC-7807 problem-details', async () => {
    const target = join(dir, 'schema.erd.json');
    const req = makeRequest('{ broken json');
    const r = makeResponse();

    await writeValidatedRawBody(req, r.res, target, DiagramSchema, PROBLEM_BASE);

    expect(r.statusCode).toBe(400);
    expect(r.headers['content-type']).toBe('application/problem+json');
    const problem = JSON.parse(r.body);
    expect(problem.type).toBe(`${PROBLEM_BASE}/invalid-json`);
    expect(problem.title).toBe('Body is not valid JSON');
    expect(problem.detail).toBeDefined();

    // Destination file MUST NOT exist — preserved.
    await expect(readFile(target, 'utf-8')).rejects.toThrow();
  });

  it('rejects schema-violating JSON with 400 + RFC-7807', async () => {
    const target = join(dir, 'schema.erd.json');
    const req = makeRequest(JSON.stringify({ format: 'wrong-format', tables: {} }));
    const r = makeResponse();

    await writeValidatedRawBody(req, r.res, target, DiagramSchema, PROBLEM_BASE);

    expect(r.statusCode).toBe(400);
    expect(r.headers['content-type']).toBe('application/problem+json');
    const problem = JSON.parse(r.body);
    expect(problem.type).toBe(`${PROBLEM_BASE}/schema-violation`);
    expect(problem.title).toBe('Schema validation failed');

    // Destination file MUST NOT be created on schema violation.
    await expect(readFile(target, 'utf-8')).rejects.toThrow();
  });

  it('accepts valid JSON, writes atomically via tmp + rename', async () => {
    const target = join(dir, 'schema.erd.json');
    const validBody = JSON.stringify({
      format: 'viso-erd-v1',
      tables: {
        users: {
          columns: [{ name: 'id', type: 'uuid', primary: true }],
        },
      },
      relations: [],
    });
    const req = makeRequest(validBody);
    const r = makeResponse();

    await writeValidatedRawBody(req, r.res, target, DiagramSchema, PROBLEM_BASE);

    expect(r.statusCode).toBe(200);
    expect(r.body).toBe('OK');
    const persisted = await readFile(target, 'utf-8');
    expect(JSON.parse(persisted)).toEqual(JSON.parse(validBody));

    // No leftover .tmp files in the directory.
    const entries = await readdir(dir);
    expect(entries.filter((e) => e.startsWith('.tmp-'))).toHaveLength(0);
  });

  it('preserves the existing file when validation fails', async () => {
    const target = join(dir, 'schema.erd.json');
    const original = JSON.stringify({
      format: 'viso-erd-v1',
      tables: {
        keep: { columns: [{ name: 'id', type: 'uuid', primary: true }] },
      },
      relations: [],
    });
    await writeFile(target, original, 'utf-8');

    const req = makeRequest('{ this is not json');
    const r = makeResponse();

    await writeValidatedRawBody(req, r.res, target, DiagramSchema, PROBLEM_BASE);

    expect(r.statusCode).toBe(400);
    // Original file is untouched — atomic-write guarantee.
    const persisted = await readFile(target, 'utf-8');
    expect(persisted).toBe(original);
  });
});
