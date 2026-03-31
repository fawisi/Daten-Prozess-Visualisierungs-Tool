import React, { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
} from '@xyflow/react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/shell/AppSidebar.js';
import { DiagramTabs } from '@/components/shell/DiagramTabs.js';
import type { DiagramFile } from '@/components/shell/AppSidebar.js';
import { TableNode } from '@/components/erd/TableNode.js';
import { RelationEdge } from '@/components/erd/RelationEdge.js';
import { StartEventNode } from '@/components/bpmn/StartEventNode.js';
import { EndEventNode } from '@/components/bpmn/EndEventNode.js';
import { TaskNode } from '@/components/bpmn/TaskNode.js';
import { GatewayNode } from '@/components/bpmn/GatewayNode.js';
import { SequenceFlowEdge } from '@/components/bpmn/SequenceFlowEdge.js';
import { EmptyState } from '@/components/shared/EmptyState.js';
import { StatusIndicator } from '@/components/shared/StatusIndicator.js';
import { useDiagramSync } from '@/hooks/useDiagramSync.js';
import { useProcessSync } from '@/hooks/useProcessSync.js';

// Stable references — outside component
const erdNodeTypes = { table: TableNode };
const erdEdgeTypes = { relation: RelationEdge };
const bpmnNodeTypes = {
  bpmnStart: StartEventNode,
  bpmnEnd: EndEventNode,
  bpmnTask: TaskNode,
  bpmnGateway: GatewayNode,
};
const bpmnEdgeTypes = { sequenceFlow: SequenceFlowEdge };

const defaultEdgeOptions = {
  type: 'smoothstep' as const,
  style: { stroke: 'var(--edge-stroke)', strokeWidth: 1.5 },
};

function ErdCanvas() {
  const { nodes, edges, status, isEmpty, onNodesChange } = useDiagramSync();

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={erdNodeTypes}
        edgeTypes={erdEdgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        connectionLineStyle={{ stroke: 'var(--edge-stroke-hover)' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--canvas-grid-dot)" />
        <MiniMap
          style={{ background: 'var(--minimap-bg)', border: '1px solid var(--controls-border)', borderRadius: '6px' }}
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

function BpmnCanvas() {
  const { nodes, edges, status, isEmpty, onNodesChange } = useProcessSync();

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={bpmnNodeTypes}
        edgeTypes={bpmnEdgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        connectionLineStyle={{ stroke: 'var(--edge-stroke-hover)' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--canvas-grid-dot)" />
        <MiniMap
          style={{ background: 'var(--minimap-bg)', border: '1px solid var(--controls-border)', borderRadius: '6px' }}
          nodeColor="var(--minimap-node)"
          maskColor="rgba(11, 14, 20, 0.85)"
        />
        <Controls />
        {/* SVG marker for arrow heads */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0 }}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--edge-stroke)" />
            </marker>
          </defs>
        </svg>
      </ReactFlow>
      {isEmpty && <EmptyState message="No process nodes yet. Use process_add_node to create nodes." />}
      <StatusIndicator status={status} />
    </div>
  );
}

export function App() {
  const [files, setFiles] = useState<DiagramFile[]>([]);
  const [openTabs, setOpenTabs] = useState<DiagramFile[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Load available files from the API
  useEffect(() => {
    fetch('/__daten-viz-api/files')
      .then((res) => res.json())
      .then((data: DiagramFile[]) => {
        setFiles(data);
        if (data.length > 0 && openTabs.length === 0) {
          setOpenTabs([data[0]]);
          setActiveTab(data[0].path);
        }
      })
      .catch(console.error);
  }, []);

  const handleFileSelect = useCallback((file: DiagramFile) => {
    setOpenTabs((prev) => {
      if (prev.some((t) => t.path === file.path)) return prev;
      return [...prev, file];
    });
    setActiveTab(file.path);
  }, []);

  const handleTabClose = useCallback((path: string) => {
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t.path !== path);
      if (next.length === 0) return prev;
      return next;
    });
    setActiveTab((prev) => {
      if (prev === path) {
        const remaining = openTabs.filter((t) => t.path !== path);
        return remaining[0]?.path ?? prev;
      }
      return prev;
    });
  }, [openTabs]);

  const activeFile = openTabs.find((t) => t.path === activeTab);

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar
          files={files}
          activeFile={activeTab}
          onFileSelect={handleFileSelect}
        />
        <SidebarInset className="flex flex-col h-screen min-h-0">
          <DiagramTabs
            tabs={openTabs.map((f) => ({ file: f }))}
            activeTab={activeTab}
            onTabSelect={setActiveTab}
            onTabClose={handleTabClose}
          />
          <div className="relative flex-1 min-h-0">
            {activeFile?.type === 'bpmn' ? <BpmnCanvas /> : <ErdCanvas />}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
