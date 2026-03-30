import React, { useState, useCallback } from 'react';
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
import { EmptyState } from '@/components/shared/EmptyState.js';
import { StatusIndicator } from '@/components/shared/StatusIndicator.js';
import { useDiagramSync } from '@/hooks/useDiagramSync.js';

// Stable references outside component — prevents React Flow re-registration
const nodeTypes = { table: TableNode };
const edgeTypes = { relation: RelationEdge };

const defaultEdgeOptions = {
  type: 'smoothstep' as const,
  style: { stroke: 'var(--edge-stroke)', strokeWidth: 1.5 },
};

// Files served by the Vite plugin
const DEFAULT_ERD_FILE: DiagramFile = {
  name: 'schema.erd',
  path: 'schema.erd.json',
  type: 'erd',
};

export function App() {
  const { nodes, edges, status, isEmpty, onNodesChange } = useDiagramSync();
  const [openTabs, setOpenTabs] = useState<DiagramFile[]>([DEFAULT_ERD_FILE]);
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_ERD_FILE.path);

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
      if (next.length === 0) return prev; // Don't close last tab
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

  const files: DiagramFile[] = [DEFAULT_ERD_FILE];

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
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
