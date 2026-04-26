import { z } from 'zod';

/**
 * System Landscape schema (C4 L1 + L2).
 *
 * Kieran-review R7 called for a discriminated union on the node kind
 * rather than a flat 7-kind enum. L1 nodes carry only (person | system
 * | external); L2 adds (container | database | cloud | boundary) plus
 * an optional `technology` field that is meaningless at L1.
 *
 * Level itself lives in a sidecar (`.landscape.mode.json`, plan P1 /
 * mode-sidecar.ts analog) — the schema does not need to store level
 * inline and v1.0 files load without migration.
 */

export const LandscapeNodeIdentifier = z
  .string()
  .regex(
    /^[a-zA-Z_][a-zA-Z0-9_-]{0,63}$/,
    'Must start with a letter or underscore, contain only alphanumerics/underscores/hyphens, max 64 chars'
  );

// Persistent status values, EN-only — mirrors src/schema.ts + src/bpmn/schema.ts.
export const LandscapeStatus = z.enum(['open', 'done', 'blocked']);

// --- L1 kinds (always valid) ---
const L1_NODE_KINDS = ['person', 'system', 'external'] as const;

const L1NodeSchema = z.object({
  kind: z.enum(L1_NODE_KINDS),
  label: z.string().max(256),
  description: z.string().max(512).optional(),
  status: LandscapeStatus.optional(),
});

// --- L2-only kinds: add technology + boundary containment. ---
const L2_ONLY_KINDS = ['container', 'database', 'cloud', 'boundary'] as const;

const L2NodeSchema = z.object({
  kind: z.enum(L2_ONLY_KINDS),
  label: z.string().max(256),
  description: z.string().max(512).optional(),
  /** Runtime / platform tag, e.g. "PostgreSQL 15", "Next.js 16 on Vercel". */
  technology: z.string().max(128).optional(),
  /**
   * For boundary-containment: the parent boundary's node id. Only valid
   * at L2. A `boundary` kind never sets `parentId` itself (boundaries
   * don't nest in v1.1).
   */
  parentId: LandscapeNodeIdentifier.optional(),
  status: LandscapeStatus.optional(),
});

/**
 * Any landscape node. The union is on the `kind` field so an L2
 * `container` is type-narrowed to L2NodeSchema and gets `technology`
 * autocomplete; an L1 `person` doesn't.
 */
export const LandscapeNodeSchema = z.discriminatedUnion('kind', [
  // Wrap L1 kinds so each gets its own literal `kind` discriminator.
  L1NodeSchema.extend({ kind: z.literal('person') }),
  L1NodeSchema.extend({ kind: z.literal('system') }),
  L1NodeSchema.extend({ kind: z.literal('external') }),
  // L2 kinds — same shape, different literal.
  L2NodeSchema.extend({ kind: z.literal('container') }),
  L2NodeSchema.extend({ kind: z.literal('database') }),
  L2NodeSchema.extend({ kind: z.literal('cloud') }),
  L2NodeSchema.extend({ kind: z.literal('boundary') }),
]);

export const LandscapeRelationSchema = z.object({
  from: LandscapeNodeIdentifier,
  to: LandscapeNodeIdentifier,
  label: z.string().max(256).optional(),
  technology: z.string().max(128).optional(),
  status: LandscapeStatus.optional(),
});

export const LandscapeSchema = z.object({
  format: z.literal('viso-landscape-v1'),
  name: z.string().max(256).optional(),
  nodes: z.record(LandscapeNodeIdentifier, LandscapeNodeSchema),
  relations: z.array(LandscapeRelationSchema),
});

export const LandscapePositionsSchema = z.record(
  LandscapeNodeIdentifier,
  z.object({ x: z.number(), y: z.number() })
);

// Inferred types
export type LandscapeStatus_ = z.infer<typeof LandscapeStatus>;
export type LandscapeNode = z.infer<typeof LandscapeNodeSchema>;
export type LandscapeRelation = z.infer<typeof LandscapeRelationSchema>;
export type Landscape = z.infer<typeof LandscapeSchema>;
export type LandscapePositions = z.infer<typeof LandscapePositionsSchema>;
export type LandscapeNodeKind = LandscapeNode['kind'];

// L1 / L2 sets for runtime level-filtering.
const L1_SET = new Set<string>(L1_NODE_KINDS);
const L2_SET = new Set<string>(L2_ONLY_KINDS);

export function isL1Kind(kind: string): boolean {
  return L1_SET.has(kind);
}

export function isL2Kind(kind: string): boolean {
  return L2_SET.has(kind);
}

export function emptyLandscape(): Landscape {
  return {
    format: 'viso-landscape-v1',
    nodes: {},
    relations: [],
  };
}
