import { z } from 'zod';

/**
 * Parse-description config (plan R7 — discriminated union on `engine`
 * so a future LLM / Claude-sampling path can slot in without breaking
 * the `regex` caller contract). In v1.1 only `regex` ships; the `llm`
 * branch is accepted at the type level and degrades gracefully to
 * `regex` at runtime (plan R5 — Claude Desktop has not shipped
 * sampling/createMessage support yet).
 */

export const ParseDescriptionConfigSchema = z.discriminatedUnion('engine', [
  z.object({
    engine: z.literal('regex'),
    /** Maximum relations / nodes to emit in one parse call. */
    maxEntities: z.number().int().positive().max(200).optional(),
  }),
  z.object({
    engine: z.literal('llm'),
    /**
     * Reserved — host-side MCP sampling provider id. When unsupported by
     * the host the parser falls back to `regex` and returns a warning.
     */
    model: z.string().optional(),
  }),
]);

export type ParseDescriptionConfig = z.infer<typeof ParseDescriptionConfigSchema>;

export const DEFAULT_PARSE_CONFIG: ParseDescriptionConfig = { engine: 'regex' };
