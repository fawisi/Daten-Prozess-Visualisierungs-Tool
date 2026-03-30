import React from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
} from '@xyflow/react';
import { TableNode } from './components/TableNode.js';
import { RelationEdge } from './components/RelationEdge.js';
import { EmptyState } from './components/EmptyState.js';
import { StatusIndicator } from './components/StatusIndicator.js';
import { useDiagramSync } from './hooks/useDiagramSync.js';

// Stable references outside component — prevents React Flow re-registration
const nodeTypes = { table: TableNode };
const edgeTypes = { relation: RelationEdge };

const defaultEdgeOptions = {
  type: 'smoothstep' as const,
  style: { stroke: 'var(--edge-stroke)', strokeWidth: 1.5 },
};

export function App() {
  const { nodes, edges, status, isEmpty, onNodesChange } = useDiagramSync();

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        connectionLineStyle={{ stroke: 'var(--edge-stroke-hover)' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--canvas-grid-dot)"
        />
        <MiniMap
          style={{
            background: 'var(--minimap-bg)',
            border: '1px solid var(--controls-border)',
            borderRadius: '6px',
          }}
          nodeColor="var(--minimap-node)"
          maskColor="rgba(11, 14, 20, 0.85)"
        />
        <Controls />
      </ReactFlow>
      {isEmpty && <EmptyState />}
      <StatusIndicator status={status} />
    </div>
  );
}
