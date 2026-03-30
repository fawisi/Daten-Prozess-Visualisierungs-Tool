import ELK from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from '@xyflow/react';
import type { Positions } from '../../schema.js';

const elk = new ELK();

const ELK_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.spacing.nodeNode': '60',
  'elk.layered.spacing.nodeNodeBetweenLayers': '100',
  'elk.padding': '[top=20,left=20,bottom=20,right=20]',
};

// Estimate node dimensions based on column count
function estimateNodeSize(columnCount: number) {
  const headerHeight = 36;
  const rowHeight = 28;
  return {
    width: 280,
    height: headerHeight + rowHeight * columnCount + 8,
  };
}

export async function computeLayout(
  nodes: Node[],
  edges: Edge[],
  existingPositions: Positions
): Promise<Node[]> {
  // Split into nodes with and without existing positions
  const needsLayout = nodes.filter((n) => !existingPositions[n.id]);

  if (needsLayout.length === 0) {
    // All nodes have positions — use them
    return nodes.map((n) => ({
      ...n,
      position: existingPositions[n.id] || n.position,
    }));
  }

  // Run ELK only on nodes that need layout
  const elkNodes = needsLayout.map((n) => {
    const colCount = (n.data as { columns: unknown[] }).columns?.length || 1;
    const { width, height } = estimateNodeSize(colCount);
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

  // Build a position map from ELK results
  const elkPositions: Record<string, { x: number; y: number }> = {};
  for (const child of layout.children || []) {
    elkPositions[child.id] = { x: child.x || 0, y: child.y || 0 };
  }

  return nodes.map((n) => ({
    ...n,
    position: existingPositions[n.id] || elkPositions[n.id] || n.position,
  }));
}
