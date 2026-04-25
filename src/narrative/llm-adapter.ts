import type { ZodSchema } from 'zod';

/**
 * Optional LLM-backed narrative parser. Activated via two env-vars:
 *   VISO_LLM_PARSE=true   — opt-in flag (defaults off so v1.x users keep
 *                           their existing regex-only contract)
 *   ANTHROPIC_API_KEY=…   — credential
 *
 * The adapter is intentionally framework-free: it speaks raw HTTPS to
 * the Anthropic Messages API rather than pulling in `@anthropic-ai/sdk`,
 * keeping the published npm package light. Hosts that already have the
 * SDK installed can wrap this adapter, or replace `tryLlmParse` with a
 * SDK-backed implementation, without breaking the regex fallback path.
 *
 * Design choices:
 * - Returns `null` (not throws) on every failure mode so the caller can
 *   transparently fall back to regex without a try/catch.
 * - Default model: claude-haiku-4-5 — fastest tier, sufficient for
 *   diagram-extraction prompts. Override via `VISO_LLM_MODEL`.
 * - 8s default timeout — narrative parsing should never block an MCP
 *   tool invocation for long.
 */

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_TIMEOUT_MS = 8000;
const ENV_FLAG = 'VISO_LLM_PARSE';

export interface LlmParseOptions<T> {
  /** The narrative the user typed. */
  text: string;
  /**
   * The Zod schema the LLM output must conform to. Validation runs after
   * the model returns; on schema-violation the adapter returns null.
   */
  schema: ZodSchema<T>;
  /** Diagram-type-specific system prompt fragment. */
  systemPrompt: string;
  /** Override the default model (otherwise reads VISO_LLM_MODEL env). */
  model?: string;
  /** Override the default 8s timeout. */
  timeoutMs?: number;
  /**
   * Injectable fetch — allows test code to swap a mock without monkey-
   * patching the global. Defaults to `globalThis.fetch`.
   */
  fetchImpl?: typeof fetch;
}

export function isLlmEnabled(): boolean {
  return process.env[ENV_FLAG] === 'true' && !!process.env.ANTHROPIC_API_KEY;
}

interface MessageContent {
  type: string;
  text?: string;
}

interface MessageResponse {
  content?: MessageContent[];
}

/**
 * Try to parse `text` into a `T` using Anthropic Messages. Returns the
 * parsed object on success, `null` on any failure (env-flag disabled,
 * network error, non-JSON response, schema violation, timeout).
 */
export async function tryLlmParse<T>(opts: LlmParseOptions<T>): Promise<T | null> {
  if (!isLlmEnabled()) return null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const fetchFn = opts.fetchImpl ?? globalThis.fetch;
  const model = opts.model ?? process.env.VISO_LLM_MODEL ?? DEFAULT_MODEL;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: opts.systemPrompt,
        messages: [{ role: 'user', content: opts.text }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const body = (await response.json()) as MessageResponse;
    const textBlock = body.content?.find((c) => c.type === 'text');
    if (!textBlock?.text) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      // Some models wrap JSON in fences — strip and retry once.
      const fenced = textBlock.text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
      if (!fenced) return null;
      try {
        parsed = JSON.parse(fenced[1]);
      } catch {
        return null;
      }
    }

    const validation = opts.schema.safeParse(parsed);
    return validation.success ? validation.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
