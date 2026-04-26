import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { tryLlmParse, isLlmEnabled } from './llm-adapter.js';

const TestSchema = z.object({
  ok: z.literal(true),
  count: z.number(),
});

describe('isLlmEnabled', () => {
  const original = { flag: process.env.VISO_LLM_PARSE, key: process.env.ANTHROPIC_API_KEY };

  afterEach(() => {
    process.env.VISO_LLM_PARSE = original.flag;
    process.env.ANTHROPIC_API_KEY = original.key;
  });

  it('returns false when the env-flag is missing', () => {
    delete process.env.VISO_LLM_PARSE;
    process.env.ANTHROPIC_API_KEY = 'key';
    expect(isLlmEnabled()).toBe(false);
  });

  it('returns false when only the env-flag is set but no API key', () => {
    process.env.VISO_LLM_PARSE = 'true';
    delete process.env.ANTHROPIC_API_KEY;
    expect(isLlmEnabled()).toBe(false);
  });

  it('returns true only with both flags', () => {
    process.env.VISO_LLM_PARSE = 'true';
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    expect(isLlmEnabled()).toBe(true);
  });
});

describe('tryLlmParse', () => {
  const original = { flag: process.env.VISO_LLM_PARSE, key: process.env.ANTHROPIC_API_KEY };

  beforeEach(() => {
    process.env.VISO_LLM_PARSE = 'true';
    process.env.ANTHROPIC_API_KEY = 'sk-test';
  });

  afterEach(() => {
    process.env.VISO_LLM_PARSE = original.flag;
    process.env.ANTHROPIC_API_KEY = original.key;
  });

  it('returns null when the env-flag is disabled (regex-fallback contract)', async () => {
    delete process.env.VISO_LLM_PARSE;
    const fetchImpl = (async () =>
      new Response('should-not-run', { status: 200 })) as unknown as typeof fetch;
    const result = await tryLlmParse({
      text: 'irrelevant',
      schema: TestSchema,
      systemPrompt: 'irrelevant',
      fetchImpl,
    });
    expect(result).toBeNull();
  });

  it('returns the parsed payload when the model emits valid JSON matching the schema', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: '{"ok":true,"count":3}' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    const result = await tryLlmParse({
      text: 'three things',
      schema: TestSchema,
      systemPrompt: 'extract count',
      fetchImpl,
    });
    expect(result).toEqual({ ok: true, count: 3 });
  });

  it('strips ```json fences before parsing', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          content: [
            {
              type: 'text',
              text: 'Sure thing!\n```json\n{"ok":true,"count":7}\n```\n',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    const result = await tryLlmParse({
      text: 'seven',
      schema: TestSchema,
      systemPrompt: 'extract',
      fetchImpl,
    });
    expect(result).toEqual({ ok: true, count: 7 });
  });

  it('returns null on a non-2xx response', async () => {
    const fetchImpl: typeof fetch = async () => new Response('rate limited', { status: 429 });
    const result = await tryLlmParse({
      text: 'x',
      schema: TestSchema,
      systemPrompt: 's',
      fetchImpl,
    });
    expect(result).toBeNull();
  });

  it('returns null when the model output fails Zod validation', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: '{"ok":false}' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    const result = await tryLlmParse({
      text: 'x',
      schema: TestSchema,
      systemPrompt: 's',
      fetchImpl,
    });
    expect(result).toBeNull();
  });

  it('returns null when fetch throws (network failure)', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error('ECONNREFUSED');
    };
    const result = await tryLlmParse({
      text: 'x',
      schema: TestSchema,
      systemPrompt: 's',
      fetchImpl,
    });
    expect(result).toBeNull();
  });
});
