import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
} from '@xyflow/react';
import type { Node, NodeMouseHandler } from '@xyflow/react';
import { TooltipProvider } from '@/components/ui/tooltip.js';
import { DiagramTabs } from '@/components/shell/DiagramTabs.js';
import { TopHeader, type ExportFormat } from '@/components/shell/TopHeader.js';
import { ToolPalette } from '@/components/shell/ToolPalette.js';
import { PropertiesPanel, type NodeUpdate } from '@/components/shell/PropertiesPanel.js';
import { CodePanel } from '@/components/shell/CodePanel.js';
import { CommandPalette, buildDefaultActions } from '@/components/shell/CommandPalette.js';
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
import { useHistory, useHistoryShortcuts } from '@/hooks/useHistory.js';
import { ToolStoreProvider, useToolStore, type SelectedNode } from '@/state/useToolStore.js';

// Stable references
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

interface CanvasHandles {
  applyAutoLayout: () => Promise<void>;
  snapshotPositions: () => Record<string, { x: number; y: number }>;
  applyPositions: (p: Record<string, { x: number; y: number }>) => void;
  sourceUrl: string;
  refreshSource: () => Promise<string>;
  putSource: (text: string) => Promise<void>;
  validateSource: (text: string) => { ok: true } | { ok: false; message: string; line?: number };
  language: 'json' | 'dbml';
  sourceTitle: string;
}

function bpmnValidate(text: string): { ok: true } | { ok: false; message: string; line?: number } {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') return { ok: false, message: 'Expected object' };
    if (parsed.format !== 'viso-bpmn-v1') {
      return { ok: false, message: `Unexpected format "${parsed.format}", expected viso-bpmn-v1` };
    }
    return { ok: true };
  } catch (e) {
    const m = /position (\d+)/.exec(String(e));
    let line: number | undefined;
    if (m) {
      line = text.slice(0, Number(m[1])).split('\n').length;
    }
    return { ok: false, message: e instanceof Error ? e.message : String(e), line };
  }
}

function erdJsonValidate(text: string): { ok: true } | { ok: false; message: string; line?: number } {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') return { ok: false, message: 'Expected object' };
    if (parsed.format !== 'viso-erd-v1') {
      return { ok: false, message: `Unexpected format "${parsed.format}"` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

function ErdCanvas({
  canvasRef,
  onSelect,
}: {
  canvasRef: React.MutableRefObject<CanvasHandles | null>;
  onSelect: (node: SelectedNode | null) => void;
}) {
  const sync = useDiagramSync();
  const { nodes, edges, status, isEmpty, onNodesChange } = sync;

  useEffect(() => {
    canvasRef.current = {
      applyAutoLayout: sync.applyAutoLayout,
      snapshotPositions: sync.snapshotPositions,
      applyPositions: sync.applyPositions,
      sourceUrl: '/__viso-api/source',
      language: 'json',
      sourceTitle: 'schema.erd.json',
      refreshSource: async () => {
        const res = await fetch('/__viso-api/source');
        return res.text();
      },
      putSource: async (text: string) => {
        const res = await fetch('/__viso-api/source', {
          method: 'PUT',
          headers: { 'Content-Type': 'text/plain' },
          body: text,
        });
        if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      },
      validateSource: erdJsonValidate,
    };
  }, [sync, canvasRef]);

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_, node) => {
      onSelect({
        id: node.id,
        type: node.type ?? 'table',
        diagramType: 'erd',
        data: node.data as Record<string, unknown>,
      });
    },
    [onSelect]
  );

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onPaneClick={() => onSelect(null)}
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

function BpmnCanvas({
  canvasRef,
  onSelect,
}: {
  canvasRef: React.MutableRefObject<CanvasHandles | null>;
  onSelect: (node: SelectedNode | null) => void;
}) {
  const sync = useProcessSync();
  const { nodes, edges, status, isEmpty, onNodesChange } = sync;

  useEffect(() => {
    canvasRef.current = {
      applyAutoLayout: sync.applyAutoLayout,
      snapshotPositions: sync.snapshotPositions,
      applyPositions: sync.applyPositions,
      sourceUrl: '/__viso-api/bpmn/source',
      language: 'json',
      sourceTitle: 'process.bpmn.json',
      refreshSource: async () => {
        const res = await fetch('/__viso-api/bpmn/source');
        return res.text();
      },
      putSource: async (text: string) => {
        const res = await fetch('/__viso-api/bpmn/source', {
          method: 'PUT',
          headers: { 'Content-Type': 'text/plain' },
          body: text,
        });
        if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      },
      validateSource: bpmnValidate,
    };
  }, [sync, canvasRef]);

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_, node) => {
      onSelect({
        id: node.id,
        type: node.type ?? 'bpmnTask',
        diagramType: 'bpmn',
        data: node.data as Record<string, unknown>,
      });
    },
    [onSelect]
  );

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onPaneClick={() => onSelect(null)}
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

function EditorShell() {
  const [files, setFiles] = useState<DiagramFile[]>([]);
  const [openTabs, setOpenTabs] = useState<DiagramFile[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [sourceText, setSourceText] = useState<string>('');
  const canvasRef = useRef<CanvasHandles | null>(null);
  const { selectedNode, setSelectedNode, codePanelOpen, setCommandPaletteOpen, toggleCodePanel } =
    useToolStore();
  const history = useHistory<Record<string, { x: number; y: number }>>();

  // Load available files
  useEffect(() => {
    fetch('/__viso-api/files')
      .then((res) => res.json())
      .then((data: DiagramFile[]) => {
        setFiles(data);
        setOpenTabs((prev) => {
          if (prev.length > 0) return prev;
          return data.slice(0, 1);
        });
        setActiveTab((prev) => prev ?? data[0]?.path ?? null);
      })
      .catch(console.error);
  }, []);

  const activeFile = openTabs.find((t) => t.path === activeTab) ?? null;
  const diagramType = activeFile?.type ?? null;

  // Load source when CodePanel opens or active file changes
  useEffect(() => {
    if (!codePanelOpen || !activeFile) return;
    const url = activeFile.type === 'bpmn' ? '/__viso-api/bpmn/source' : '/__viso-api/source';
    fetch(url)
      .then((r) => r.text())
      .then(setSourceText)
      .catch(console.error);
  }, [codePanelOpen, activeFile]);

  const handleTabClose = useCallback((path: string) => {
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t.path !== path);
      return next.length === 0 ? prev : next;
    });
    setActiveTab((prev) => {
      if (prev !== path) return prev;
      const remaining = openTabs.filter((t) => t.path !== path);
      return remaining[0]?.path ?? prev;
    });
  }, [openTabs]);

  const handleAutoLayout = useCallback(async () => {
    const prev = canvasRef.current?.snapshotPositions();
    if (prev) history.record(prev);
    await canvasRef.current?.applyAutoLayout();
  }, [history]);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!activeFile) return;
      if (format === 'dbml' || format === 'mermaid' || format === 'sql' || format === 'svg' || format === 'png') {
        // MVP: raw source download for the underlying file; formatted exports land in Phase 5.
        const handles = canvasRef.current;
        if (!handles) return;
        if (format === 'dbml' && activeFile.type !== 'erd') {
          window.alert('DBML export is ERD-only.');
          return;
        }
        if (format === 'sql' && activeFile.type !== 'erd') {
          window.alert('SQL export is ERD-only.');
          return;
        }
        if (format === 'svg' || format === 'png' || format === 'mermaid' || format === 'sql') {
          window.alert(`${format.toUpperCase()} export arrives with Phase 5 HTTP-adapter. For now, use the CLI: viso-mcp export --format ${format}`);
          return;
        }
        const text = await handles.refreshSource();
        const blob = new Blob([text], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${activeFile.name}.${format}`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    },
    [activeFile]
  );

  const handleSaveSource = useCallback(async (next: string) => {
    await canvasRef.current?.putSource(next);
  }, []);

  const handleUpdateNode = useCallback(
    (_id: string, _update: NodeUpdate) => {
      // TODO: wire to HTTP-adapter (Phase 5). For now, log so users see the plumbing.
      // eslint-disable-next-line no-console
      console.info('PropertiesPanel update (pending HTTP-adapter):', _id, _update);
    },
    []
  );

  const handleUndo = useCallback(() => {
    const prev = history.undo();
    if (prev) canvasRef.current?.applyPositions(prev);
  }, [history]);

  const handleRedo = useCallback(() => {
    const next = history.redo();
    if (next) canvasRef.current?.applyPositions(next);
  }, [history]);

  useHistoryShortcuts({ onUndo: handleUndo, onRedo: handleRedo });

  const actions = useMemo(
    () =>
      buildDefaultActions({
        onAddNode: (type) => window.alert(`"Add ${type}" — wiring via set_bpmn lands in Phase 5.`),
        onExport: handleExport,
        onToggleCode: toggleCodePanel,
        onAutoLayout: handleAutoLayout,
        onUndo: handleUndo,
        onRedo: handleRedo,
        onSwitchDiagram: files.length > 1 ? () => setCommandPaletteOpen(true) : undefined,
      }),
    [handleExport, toggleCodePanel, handleAutoLayout, handleUndo, handleRedo, files.length, setCommandPaletteOpen]
  );

  const fileName = activeFile?.name ?? null;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <TopHeader
        fileName={fileName}
        badge={files.length > 0 ? 'HYBRID' : undefined}
        onAutoLayout={handleAutoLayout}
        onExport={handleExport}
      />
      {openTabs.length > 1 && (
        <DiagramTabs
          tabs={openTabs.map((f) => ({ file: f }))}
          activeTab={activeTab}
          onTabSelect={setActiveTab}
          onTabClose={handleTabClose}
        />
      )}
      <div className="flex flex-1 min-h-0">
        <ToolPalette diagramType={diagramType} />
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0 relative">
            {diagramType === 'bpmn' ? (
              <BpmnCanvas canvasRef={canvasRef} onSelect={setSelectedNode} />
            ) : diagramType === 'erd' ? (
              <ErdCanvas canvasRef={canvasRef} onSelect={setSelectedNode} />
            ) : (
              <CanvasEmpty />
            )}
          </div>
          {codePanelOpen && canvasRef.current && (
            <CodePanel
              title={canvasRef.current.sourceTitle}
              language={canvasRef.current.language}
              source={sourceText}
              onSave={handleSaveSource}
              validate={canvasRef.current.validateSource}
            />
          )}
        </div>
        <PropertiesPanel
          diagramMeta={{
            name: fileName ?? undefined,
            format: diagramType === 'bpmn' ? 'viso-bpmn-v1' : diagramType === 'erd' ? 'viso-erd-v1' : undefined,
            itemCount: selectedNode ? undefined : files.length,
            itemLabel: 'Open Files',
          }}
          onUpdateNode={handleUpdateNode}
        />
      </div>
      <FooterBar />
      <CommandPalette diagramType={diagramType} actions={actions} />
    </div>
  );
}

function CanvasEmpty() {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="rounded-lg border-dashed border-2 border-muted p-6 max-w-md text-center space-y-2 text-sm text-muted-foreground">
        <p className="text-base font-semibold text-foreground">No diagram loaded</p>
        <p>
          Click a shape in the sidebar or press{' '}
          <kbd className="px-1 py-0.5 rounded border bg-muted font-mono text-[11px]">Cmd</kbd>
          <span className="mx-0.5">+</span>
          <kbd className="px-1 py-0.5 rounded border bg-muted font-mono text-[11px]">K</kbd>
          {' '}to open the command palette.
        </p>
      </div>
    </div>
  );
}

function FooterBar() {
  return (
    <footer className="border-t px-4 py-2 bg-background/60 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
      <span>
        Canvas-first Zeichnen · Tools links (aktiv: Pointer) · Properties rechts fuer selektierten Node
      </span>
      <span className="italic">
        Cmd+/ → DBML/JSON-Code-Panel unten einblendbar (Power-Mode)
      </span>
    </footer>
  );
}

export function App() {
  return (
    <TooltipProvider>
      <ToolStoreProvider>
        <EditorShell />
      </ToolStoreProvider>
    </TooltipProvider>
  );
}
