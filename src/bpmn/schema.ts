import { z } from 'zod';

// Safe identifier for node IDs: letters, digits, underscores, hyphens, max 64 chars
export const NodeIdentifier = z
  .string()
  .regex(
    /^[a-zA-Z_][a-zA-Z0-9_-]{0,63}$/,
    'Must start with a letter or underscore, contain only alphanumerics/underscores/hyphens, max 64 chars'
  );

export const ProcessNodeType = z.enum([
  'start-event',
  'end-event',
  'task',
  'gateway',
]);

export const GatewayType = z.enum(['exclusive']);

// Persistent status values are English so agents + exports stay locale-free.
// The UI renders them in the active language via useI18n().
export const NodeStatus = z.enum(['open', 'done', 'blocked']);

export const ProcessNodeSchema = z.object({
  type: ProcessNodeType.describe('Node type'),
  label: z.string().max(256).describe('Display label'),
  description: z
    .string()
    .max(512)
    .optional()
    .describe('Human-readable description'),
  gatewayType: GatewayType.optional().describe(
    'Gateway type (only for gateway nodes)'
  ),
  status: NodeStatus.optional().describe(
    'Consulting status: open = pending, done = ready, blocked = problem/obstacle'
  ),
});

export const FlowSchema = z.object({
  from: NodeIdentifier.describe('Source node ID'),
  to: NodeIdentifier.describe('Target node ID'),
  label: z.string().max(256).nullable().optional().describe('Flow label (e.g. "Yes", "No")'),
});

export const ProcessSchema = z.object({
  format: z.literal('viso-bpmn-v1'),
  name: z.string().max(256).optional().describe('Process name'),
  nodes: z.record(NodeIdentifier, ProcessNodeSchema),
  flows: z.array(FlowSchema),
});

export const ProcessPositionsSchema = z.record(
  NodeIdentifier,
  z.object({ x: z.number(), y: z.number() })
);

// Inferred types
export type ProcessNodeType_ = z.infer<typeof ProcessNodeType>;
export type GatewayType_ = z.infer<typeof GatewayType>;
export type NodeStatus_ = z.infer<typeof NodeStatus>;
export type ProcessNode = z.infer<typeof ProcessNodeSchema>;
export type Flow = z.infer<typeof FlowSchema>;
export type Process = z.infer<typeof ProcessSchema>;
export type ProcessPositions = z.infer<typeof ProcessPositionsSchema>;

// Empty process factory
export function emptyProcess(): Process {
  return {
    format: 'viso-bpmn-v1',
    nodes: {},
    flows: [],
  };
}
