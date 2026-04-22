import type { Process } from './schema.js';
import { applyMermaidTheme, bpmnClassDefs } from '../theme.js';

const NODE_SHAPE: Record<string, (id: string, label: string) => string> = {
  'start-event': (id, label) => `    ${id}(("${label}"))`,
  'end-event': (id, label) => `    ${id}(("${label}"))`,
  'task': (id, label) => `    ${id}["${label}"]`,
  'gateway': (id, label) => `    ${id}{"${label}"}`,
};

export interface MermaidExportOptions {
  /** When provided, wraps the output in an `%%{init}%%` directive. */
  theme?: 'light' | 'dark';
}

export function processToMermaid(process: Process, options: MermaidExportOptions = {}): string {
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

  // Apply shared TAFKA classDefs instead of inline hex colours so the
  // export stays consistent with the React Flow canvas theme.
  lines.push(...bpmnClassDefs());
  if (startNodes.length > 0) {
    lines.push(`    class ${startNodes.join(',')} startEvent`);
  }
  if (endNodes.length > 0) {
    lines.push(`    class ${endNodes.join(',')} endEvent`);
  }
  if (gatewayNodes.length > 0) {
    lines.push(`    class ${gatewayNodes.join(',')} gateway`);
  }
  const taskNodes = nodeIds.filter((id) => process.nodes[id].type === 'task');
  if (taskNodes.length > 0) {
    lines.push(`    class ${taskNodes.join(',')} task`);
  }

  const body = lines.join('\n') + '\n';
  return options.theme ? applyMermaidTheme(body, options.theme) : body;
}
