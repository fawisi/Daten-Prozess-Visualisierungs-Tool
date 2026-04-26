import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ProcessStore } from './store.js';
import {
  NodeIdentifier,
  NodeStatus,
  ProcessNodeType,
  GatewayType,
  ProcessSchema,
} from './schema.js';
import { processToMermaid } from './export-mermaid.js';
import { derivePositionsPath, prunePositions } from '../positions.js';
import { loadModeSidecar, saveModeSidecar } from '../mode-sidecar.js';
import { bpmnOnlyNodeIds, inferProcessMode } from './mode-heuristic.js';
import { parseProcessDescription } from './parse-description.js';
import { ParseDescriptionConfigSchema } from '../narrative/config.js';
import type { Process } from './schema.js';

function processSummary(p: Process): string {
  const n = Object.keys(p.nodes).length;
  const f = p.flows.length;
  return `Process now has ${n} node${n !== 1 ? 's' : ''}, ${f} flow${f !== 1 ? 's' : ''}.`;
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function problemResult(body: Record<string, unknown>) {
  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(body, null, 2),
      },
    ],
  };
}

export function registerProcessTools(server: McpServer, store: ProcessStore) {
  // --- process_add_node ---
  server.registerTool(
    'process_add_node',
    {
      description:
        'Add a node to the process diagram (task, gateway, start-event, or end-event). If the process is in `simple` mode (see `process_get_mode`), BPMN-only gateway kinds (inclusive/parallel) are persisted but hidden in the canvas — switch to `bpmn` mode with `process_set_mode` before placing them, or warn the user. For > 3 mutations in a single turn prefer `set_bpmn`.',
      inputSchema: z.object({
        id: NodeIdentifier.describe('Unique node ID'),
        type: ProcessNodeType.describe('Node type'),
        label: z.string().max(256).describe('Display label'),
        description: z
          .string()
          .max(512)
          .optional()
          .describe('Human-readable description'),
        gatewayType: GatewayType.optional().describe(
          'Gateway type (only for gateway nodes, default: exclusive)'
        ),
      }),
    },
    async ({ id, type, label, description, gatewayType }) => {
      const process = await store.load();

      if (process.nodes[id]) {
        return textResult(
          `Node "${id}" already exists. Use process_remove_node first if you want to recreate it.`
        );
      }

      // Validate: max 1 start-event
      if (type === 'start-event') {
        const existing = Object.entries(process.nodes).find(
          ([, n]) => n.type === 'start-event'
        );
        if (existing) {
          return textResult(
            `A start event already exists ("${existing[0]}"). Only one start event is allowed.`
          );
        }
      }

      process.nodes[id] = {
        type,
        label,
        ...(description ? { description } : {}),
        ...(type === 'gateway'
          ? { gatewayType: gatewayType ?? 'exclusive' }
          : {}),
      };
      await store.save(process);
      return textResult(
        `Added ${type} "${id}" with label "${label}". ${processSummary(process)}`
      );
    }
  );

  // --- process_remove_node ---
  server.registerTool(
    'process_remove_node',
    {
      description:
        'Remove a node and all its connected flows from the process diagram',
      inputSchema: z.object({
        id: NodeIdentifier.describe('ID of the node to remove'),
      }),
    },
    async ({ id }) => {
      const process = await store.load();

      if (!process.nodes[id]) {
        const available = Object.keys(process.nodes).join(', ') || '(none)';
        return textResult(
          `Node "${id}" not found. Available nodes: ${available}.`
        );
      }

      delete process.nodes[id];
      const before = process.flows.length;
      process.flows = process.flows.filter(
        (f) => f.from !== id && f.to !== id
      );
      const cascaded = before - process.flows.length;
      await store.save(process);
      return textResult(
        `Removed node "${id}"${cascaded > 0 ? ` and ${cascaded} connected flow${cascaded !== 1 ? 's' : ''}` : ''}. ${processSummary(process)}`
      );
    }
  );

  // --- process_add_flow ---
  server.registerTool(
    'process_add_flow',
    {
      description:
        'Add a sequence flow between two nodes. For > 3 mutations in a single turn prefer `set_bpmn`.',
      inputSchema: z.object({
        from: NodeIdentifier.describe('Source node ID'),
        to: NodeIdentifier.describe('Target node ID'),
        label: z
          .string()
          .max(256)
          .optional()
          .describe('Flow label (e.g. "Yes", "No")'),
      }),
    },
    async ({ from, to, label }) => {
      const process = await store.load();

      if (!process.nodes[from]) {
        const available = Object.keys(process.nodes).join(', ') || '(none)';
        return textResult(
          `Source node "${from}" not found. Available nodes: ${available}.`
        );
      }
      if (!process.nodes[to]) {
        const available = Object.keys(process.nodes).join(', ') || '(none)';
        return textResult(
          `Target node "${to}" not found. Available nodes: ${available}.`
        );
      }

      const exists = process.flows.some(
        (f) => f.from === from && f.to === to
      );
      if (exists) {
        return textResult(
          `Flow from "${from}" to "${to}" already exists.`
        );
      }

      process.flows.push({
        from,
        to,
        label: label ?? null,
      });
      await store.save(process);
      return textResult(
        `Added flow from "${from}" to "${to}"${label ? ` with label "${label}"` : ''}. ${processSummary(process)}`
      );
    }
  );

  // --- process_remove_flow ---
  server.registerTool(
    'process_remove_flow',
    {
      description: 'Remove a sequence flow between two nodes',
      inputSchema: z.object({
        from: NodeIdentifier.describe('Source node ID'),
        to: NodeIdentifier.describe('Target node ID'),
      }),
    },
    async ({ from, to }) => {
      const process = await store.load();
      const before = process.flows.length;
      process.flows = process.flows.filter(
        (f) => !(f.from === from && f.to === to)
      );
      const removed = before - process.flows.length;
      if (removed === 0) {
        return textResult(
          `No flow found from "${from}" to "${to}".`
        );
      }
      await store.save(process);
      return textResult(
        `Removed flow from "${from}" to "${to}". ${processSummary(process)}`
      );
    }
  );

  // --- process_get_schema ---
  server.registerTool(
    'process_get_schema',
    {
      description:
        'Read the current process diagram schema. Returns `{ process, metadata }` where `process` is the ProcessSchema payload (feed directly to `set_bpmn` to round-trip) and `metadata` is read-only sidecar state: `mode` (simple | bpmn) and `hiddenIds` (BPMN-only nodes currently hidden in simple mode).',
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      const process = await store.load();
      const sidecar = await loadModeSidecar(store.filePath);
      const mode =
        sidecar?.kind === 'bpmn' ? sidecar.mode : inferProcessMode(process);
      // Response envelope: `process` carries the ProcessSchema-shaped
      // payload an agent can feed straight back into `set_bpmn`;
      // `metadata` is read-only sidecar-derived state that must not be
      // written back. Keeping them in separate keys prevents the
      // silent-strip hazard (kieran-review P1 B1).
      const hiddenIds = bpmnOnlyNodeIds(process);
      return textResult(
        JSON.stringify({ process, metadata: { mode, hiddenIds } }, null, 2)
      );
    }
  );

  // --- process_export_mermaid ---
  server.registerTool(
    'process_export_mermaid',
    {
      description:
        'Export the current process diagram as Mermaid flowchart syntax',
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      const process = await store.load();
      if (Object.keys(process.nodes).length === 0) {
        return textResult('Process is empty. Add nodes first.');
      }
      return textResult(processToMermaid(process));
    }
  );

  // --- set_bpmn ---
  server.registerTool(
    'set_bpmn',
    {
      description:
        'Replace the entire BPMN process with new JSON in one call. Atomic — the file stays unchanged on parse error. Orphan positions (nodes that no longer exist) are pruned from the sidecar. For > 3 mutations prefer this over atomic add/remove tools. The canonical parameter is `process`; the legacy `json` alias is accepted for backwards compatibility (MA-4).',
      inputSchema: z
        .object({
          process: z
            .string()
            .min(1, 'BPMN process JSON cannot be empty')
            .describe('Complete BPMN process as a JSON string')
            .optional(),
          json: z
            .string()
            .min(1)
            .describe('@deprecated — use `process` instead (kept for v1.0 compat)')
            .optional(),
        })
        .refine((d) => d.process !== undefined || d.json !== undefined, {
          message: 'Either `process` or `json` must be provided',
        }),
      annotations: {
        destructiveHint: true,
        idempotentHint: true,
      },
    },
    async (input) => {
      const json = input.process ?? input.json!;
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch (err) {
        return problemResult({
          type: 'https://viso-mcp.dev/problems/bpmn-parse-error',
          title: 'BPMN JSON parse error',
          detail: (err as Error).message,
        });
      }

      const validated = ProcessSchema.safeParse(parsed);
      if (!validated.success) {
        return problemResult({
          type: 'https://viso-mcp.dev/problems/bpmn-schema-invalid',
          title: 'BPMN JSON failed schema validation',
          detail: 'Zod validation failed — see errors[] for details',
          errors: validated.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        });
      }

      await store.save(validated.data);

      const validIds = new Set(Object.keys(validated.data.nodes));
      const prunedIds = await prunePositions(
        derivePositionsPath(store.filePath),
        validIds
      );

      return textResult(
        JSON.stringify(
          {
            ok: true,
            nodeCount: Object.keys(validated.data.nodes).length,
            flowCount: validated.data.flows.length,
            prunedPositions: prunedIds,
          },
          null,
          2
        )
      );
    }
  );

  // --- process_set_node_status ---
  server.registerTool(
    'process_set_node_status',
    {
      description:
        'Set the consulting status of a process node. Status drives Mermaid stroke colour and the PropertiesPanel badge. Pass status=null to clear.',
      inputSchema: z.object({
        id: NodeIdentifier.describe('Node ID to update'),
        status: NodeStatus.nullable().describe(
          "Status: 'open' (pending), 'done' (ready), 'blocked' (problem). null clears."
        ),
      }),
      annotations: {
        idempotentHint: true,
      },
    },
    async ({ id, status }) => {
      const process = await store.load();
      if (!process.nodes[id]) {
        const available = Object.keys(process.nodes).join(', ') || '(none)';
        return textResult(
          `Node "${id}" not found. Available nodes: ${available}.`
        );
      }
      if (status === null) {
        delete process.nodes[id].status;
      } else {
        process.nodes[id].status = status;
      }
      await store.save(process);
      return textResult(
        status === null
          ? `Cleared status on "${id}".`
          : `Set status of "${id}" to "${status}".`
      );
    }
  );

  // --- process_update_node ---
  server.registerTool(
    'process_update_node',
    {
      description:
        'Update mutable fields on a process node (label, description, gatewayType). Omitted fields are left unchanged; description="" clears it.',
      inputSchema: z.object({
        id: NodeIdentifier.describe('Node ID to update'),
        label: z.string().max(256).optional().describe('New label'),
        description: z
          .string()
          .max(512)
          .optional()
          .describe('New description; empty string clears it'),
        gatewayType: GatewayType.optional().describe('Gateway subtype (gateway nodes only)'),
      }),
      annotations: {
        idempotentHint: true,
      },
    },
    async ({ id, label, description, gatewayType }) => {
      const process = await store.load();
      const node = process.nodes[id];
      if (!node) {
        const available = Object.keys(process.nodes).join(', ') || '(none)';
        return textResult(`Node "${id}" not found. Available nodes: ${available}.`);
      }
      if (label !== undefined) node.label = label;
      if (description !== undefined) {
        if (description === '') delete node.description;
        else node.description = description;
      }
      if (gatewayType !== undefined) {
        if (node.type !== 'gateway') {
          return textResult(
            `Node "${id}" is not a gateway — gatewayType can only be set on gateway nodes.`
          );
        }
        node.gatewayType = gatewayType;
      }
      await store.save(process);
      return textResult(`Updated node "${id}".`);
    }
  );

  // --- process_set_mode ---
  // Writes the mode sidecar only; v1.1.0 wires it into the UI in P1. The
  // tool is exposed in P0 so agents can start persisting mode choices
  // before the canvas toggles it.
  server.registerTool(
    'process_set_mode',
    {
      description:
        "Set the process-mode sidecar (simple | bpmn). Simple-mode hides BPMN-only UI elements (inclusive/parallel gateways, timer events — see `metadata.hiddenIds` from `process_get_schema`) but keeps all nodes in the schema (nondestructive downgrade). Mode is persisted in <file>.bpmn.mode.json next to the source — not in the process JSON.",
      inputSchema: z.object({
        mode: z
          .enum(['simple', 'bpmn'])
          .describe("'simple' for consulting intake, 'bpmn' for BPMN-2.0 profi"),
      }),
      annotations: {
        idempotentHint: true,
      },
    },
    async ({ mode }) => {
      await saveModeSidecar(store.filePath, {
        kind: 'bpmn',
        mode,
        version: '1.1',
      });
      return textResult(
        JSON.stringify({ ok: true, mode, sidecarFor: store.filePath }, null, 2)
      );
    }
  );

  // --- process_parse_description ---
  server.registerTool(
    'process_parse_description',
    {
      description:
        "Parse German narrative text into process nodes + flows. Supports 'Zuerst…', 'Dann…', 'Wenn … dann … sonst …' (→ XOR gateway), 'Am Ende…'. Degrades engine=llm to regex with a warning (MCP sampling not yet host-supported). Pass `persist: false` to preview the result without writing.",
      inputSchema: z.object({
        text: z.string().min(1).max(20000),
        config: ParseDescriptionConfigSchema.optional(),
        persist: z.boolean().default(true),
      }),
      annotations: { idempotentHint: true },
    },
    async ({ text, config, persist }) => {
      const base = await store.load();
      const result = parseProcessDescription(text, config, base);
      // MA-7: persisted=false when the parser added nothing new.
      const noOp = result.stats.nodesAdded === 0 && result.stats.flowsAdded === 0;
      const persisted = persist && !noOp;
      if (persisted) await store.save(result.process);
      return textResult(
        JSON.stringify(
          {
            ok: true,
            engineUsed: result.engineUsed,
            stats: result.stats,
            warnings: result.warnings,
            unparsedSpans: result.unparsedSpans,
            persisted,
            noOp,
            nodeCount: Object.keys(result.process.nodes).length,
            flowCount: result.process.flows.length,
          },
          null,
          2
        )
      );
    }
  );

  // --- process_get_mode ---
  server.registerTool(
    'process_get_mode',
    {
      description:
        "Read the process-mode sidecar. Returns 'bpmn' as default when no sidecar exists and the file uses BPMN-only elements; 'simple' when empty. A v1.1 P1 heuristic may override this in the canvas.",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      const sidecar = await loadModeSidecar(store.filePath);
      if (sidecar && sidecar.kind === 'bpmn') {
        return textResult(
          JSON.stringify({ mode: sidecar.mode, source: 'sidecar' }, null, 2)
        );
      }
      return textResult(
        JSON.stringify({ mode: 'simple', source: 'default' }, null, 2)
      );
    }
  );
}
