import { writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import type { ServerResponse, IncomingMessage } from 'node:http';
import type { ZodSchema } from 'zod';

/**
 * RFC-7807 Problem Details (https://datatracker.ietf.org/doc/html/rfc7807).
 * Returned as `application/problem+json` on every 4xx from a PUT-source
 * handler so MCP-tools, curl callers, and the Code-Panel UI all see the
 * same machine-readable failure shape.
 */
export interface ProblemDetails {
  type: string;
  title: string;
  detail: string;
  instance?: string;
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => resolvePromise(body));
    req.on('error', reject);
  });
}

function sendProblem(
  res: ServerResponse,
  status: number,
  problem: ProblemDetails
): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/problem+json');
  res.end(JSON.stringify(problem));
}

/**
 * Atomic, validating PUT-handler. The body is parsed as JSON, validated
 * against `schema`, then written via tmp + rename so the destination is
 * never observed in a half-written state. On any failure the destination
 * file is left untouched and a `application/problem+json` response is
 * returned per RFC-7807.
 *
 * Replaces the unvalidated `writeRawBody` from vite-plugin.ts which
 * accepted broken JSON with 200 OK and overwrote the source file —
 * the failure mode that destroyed test-schema.erd.json during the
 * 2026-04-25 user test (Critical Finding CR-4).
 */
export async function writeValidatedRawBody<T>(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string,
  schema: ZodSchema<T>,
  problemBaseUri: string
): Promise<void> {
  const text = await readBody(req);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return sendProblem(res, 400, {
      type: `${problemBaseUri}/invalid-json`,
      title: 'Body is not valid JSON',
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  const validation = schema.safeParse(parsed);
  if (!validation.success) {
    return sendProblem(res, 400, {
      type: `${problemBaseUri}/schema-violation`,
      title: 'Schema validation failed',
      detail: validation.error.message,
    });
  }

  // Atomic write via tmp + rename. The tmp filename uses randomUUID so
  // two concurrent PUTs against the same path don't collide on a single
  // `.tmp` slot. On any IO failure we attempt to unlink the orphan tmp
  // so we don't litter the workspace with `.tmp-…` files.
  const tmp = join(dirname(filePath), `.tmp-${randomUUID()}.json`);
  try {
    await writeFile(tmp, text, 'utf-8');
    await rename(tmp, filePath);
  } catch (err) {
    await unlink(tmp).catch(() => {
      /* swallow — tmp may not exist if writeFile threw */
    });
    return sendProblem(res, 500, {
      type: `${problemBaseUri}/write-failed`,
      title: 'Atomic write failed',
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('OK');
}
