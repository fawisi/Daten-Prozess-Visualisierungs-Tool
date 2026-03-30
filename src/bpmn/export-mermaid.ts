import type { Process } from './schema.js';

const NODE_SHAPE: Record<string, (id: string, label: string) => string> = {
  'start-event': (id, label) => `    ${id}(("${label}"))`,
  'end-event': (id, label) => `    ${id}(("${label}"))`,
  'task': (id, label) => `    ${id}["${label}"]`,
  'gateway': (id, label) => `    ${id}{"${label}"}`,
};

export function processToMermaid(process: Process): string {
  const lines: string[] = ['flowchart LR'];

  // Sort node IDs for deterministic output
  const nodeIds = Object.keys(process.nodes).sort();

  for (const id of nodeIds) {
    const node = process.nodes[id];
    const shapeFn = NODE_SHAPE[node.type];
    if (shapeFn) {
      lines.push(shapeFn(id, node.label));
    }
  }

  // Style classes for start/end events
  const startNodes = nodeIds.filter((id) => process.nodes[id].type === 'start-event');
  const endNodes = nodeIds.filter((id) => process.nodes[id].type === 'end-event');
  const gatewayNodes = nodeIds.filter((id) => process.nodes[id].type === 'gateway');

  // Sort flows for deterministic output
  const sortedFlows = [...process.flows].sort((a, b) => {
    const aKey = `${a.from}-${a.to}`;
    const bKey = `${b.from}-${b.to}`;
    return aKey.localeCompare(bKey);
  });

  for (const flow of sortedFlows) {
    if (flow.label) {
      lines.push(`    ${flow.from} -->|"${flow.label}"| ${flow.to}`);
    } else {
      lines.push(`    ${flow.from} --> ${flow.to}`);
    }
  }

  // Add styles
  if (startNodes.length > 0) {
    lines.push(`    style ${startNodes.join(',')} fill:#22C55E,stroke:#22C55E,color:#000`);
  }
  if (endNodes.length > 0) {
    lines.push(`    style ${endNodes.join(',')} fill:#EF4444,stroke:#EF4444,color:#fff`);
  }
  if (gatewayNodes.length > 0) {
    lines.push(`    style ${gatewayNodes.join(',')} fill:#F59E0B,stroke:#F59E0B,color:#000`);
  }

  return lines.join('\n') + '\n';
}
