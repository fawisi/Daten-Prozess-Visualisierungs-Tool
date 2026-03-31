import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ProcessStore } from './store.js';
import { NodeIdentifier, ProcessNodeType, GatewayType } from './schema.js';
import { processToMermaid } from './export-mermaid.js';
import type { Process } from './schema.js';

function processSummary(p: Process): string {
  const n = Object.keys(p.nodes).length;
  const f = p.flows.length;
  return `Process now has ${n} node${n !== 1 ? 's' : ''}, ${f} flow${f !== 1 ? 's' : ''}.`;
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function registerProcessTools(server: McpServer, store: ProcessStore) {
  // --- process_add_node ---
  server.registerTool(
    'process_add_node',
    {
      description:
        'Add a node to the process diagram (task, gateway, start-event, or end-event)',
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
      description: 'Add a sequence flow between two nodes',
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
      description: 'Read the current process diagram schema as JSON',
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      const process = await store.load();
      return textResult(JSON.stringify(process, null, 2));
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
}
