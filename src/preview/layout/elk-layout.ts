import ELK from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from '@xyflow/react';

const elk = new ELK();

const ELK_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.spacing.nodeNode': '60',
  'elk.layered.spacing.nodeNodeBetweenLayers': '100',
  'elk.padding': '[top=20,left=20,bottom=20,right=20]',
};

// BPMN node fixed sizes
const BPMN_NODE_SIZES: Record<string, { width: number; height: number }> = {
  bpmnStart: { width: 40, height: 40 },
  bpmnEnd: { width: 40, height: 40 },
  bpmnTask: { width: 160, height: 60 },
  bpmnGateway: { width: 48, height: 48 },
};

// Estimate node dimensions based on type
function estimateNodeSize(node: Node): { width: number; height: number } {
  // BPMN nodes have fixed sizes
  if (node.type && BPMN_NODE_SIZES[node.type]) {
    return BPMN_NODE_SIZES[node.type];
  }

  // ERD table nodes: size based on column count
  const colCount = (node.data as { columns?: unknown[] })?.columns?.length || 1;
  const headerHeight = 36;
  const rowHeight = 28;
  return {
    width: 280,
    height: headerHeight + rowHeight * colCount + 8,
  };
}

export async function computeLayout(
  nodes: Node[],
  edges: Edge[],
  existingPositions: Record<string, { x: number; y: number }>
): Promise<Node[]> {
  const needsLayout = nodes.filter((n) => !existingPositions[n.id]);

  if (needsLayout.length === 0) {
    return nodes.map((n) => ({
      ...n,
      position: existingPositions[n.id] || n.position,
    }));
  }

  const elkNodes = needsLayout.map((n) => {
    const { width, height } = estimateNodeSize(n);
    return { id: n.id, width, height };
  });

  const elkEdges = edges
    .filter(
      (e) =>
        needsLayout.some((n) => n.id === e.source) ||
        needsLayout.some((n) => n.id === e.target)
    )
    .map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    }));

  const layout = await elk.layout({
    id: 'root',
    layoutOptions: ELK_OPTIONS,
    children: elkNodes,
    edges: elkEdges,
  });

  const elkPositions: Record<string, { x: number; y: number }> = {};
  for (const child of layout.children || []) {
    elkPositions[child.id] = { x: child.x || 0, y: child.y || 0 };
  }

  return nodes.map((n) => ({
    ...n,
    position: existingPositions[n.id] || elkPositions[n.id] || n.position,
  }));
}
