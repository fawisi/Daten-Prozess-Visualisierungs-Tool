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
import { PropertiesPanel, type NodeUpdate, type PropertiesPanelProps } from '@/components/shell/PropertiesPanel.js';
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
import { useApiConfig } from '@/state/ApiConfig.js';
import type { Process } from '../bpmn/schema.js';

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
  const api = useApiConfig();
  const sync = useDiagramSync();
  const { nodes, edges, status, isEmpty, onNodesChange } = sync;

  useEffect(() => {
    const erdSourceUrl = api.endpoints.erdSource;
    const authHeader = api.endpoints.authHeader;
    canvasRef.current = {
      applyAutoLayout: sync.applyAutoLayout,
      snapshotPositions: sync.snapshotPositions,
      applyPositions: sync.applyPositions,
      sourceUrl: erdSourceUrl,
      language: 'json',
      sourceTitle: 'schema.erd.json',
      refreshSource: async () => {
        const res = await fetch(erdSourceUrl, authHeader ? { headers: { Authorization: authHeader } } : undefined);
        return res.text();
      },
      putSource: async (text: string) => {
        const res = await fetch(erdSourceUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'text/plain',
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: text,
        });
        if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      },
      validateSource: erdJsonValidate,
    };
  }, [sync, canvasRef, api]);

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
  onPaneClick,
}: {
  canvasRef: React.MutableRefObject<CanvasHandles | null>;
  onSelect: (node: SelectedNode | null) => void;
  onPaneClick?: (flowPos: { x: number; y: number }) => void;
}) {
  const api = useApiConfig();
  const sync = useProcessSync();
  const { nodes, edges, status, isEmpty, onNodesChange } = sync;

  useEffect(() => {
    const bpmnSourceUrl = api.endpoints.bpmnSource;
    const authHeader = api.endpoints.authHeader;
    canvasRef.current = {
      applyAutoLayout: sync.applyAutoLayout,
      snapshotPositions: sync.snapshotPositions,
      applyPositions: sync.applyPositions,
      sourceUrl: bpmnSourceUrl,
      language: 'json',
      sourceTitle: 'process.bpmn.json',
      refreshSource: async () => {
        const res = await fetch(bpmnSourceUrl, authHeader ? { headers: { Authorization: authHeader } } : undefined);
        return res.text();
      },
      putSource: async (text: string) => {
        const res = await fetch(bpmnSourceUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'text/plain',
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: text,
        });
        if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      },
      validateSource: bpmnValidate,
    };
  }, [sync, canvasRef, api]);

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

  const handlePaneClick = useCallback(
    (evt: React.MouseEvent<HTMLDivElement>) => {
      if (onPaneClick) {
        // ReactFlow does not expose the project helper outside its hook, so
        // approximate with the raw pane offset. The position writer
        // overlays ELK / user-placed positions on next load; this is good
        // enough for a first spawn.
        const bounds = (evt.currentTarget as HTMLElement).getBoundingClientRect();
        onPaneClick({ x: evt.clientX - bounds.left, y: evt.clientY - bounds.top });
      } else {
        onSelect(null);
      }
    },
    [onPaneClick, onSelect]
  );

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onPaneClick={handlePaneClick}
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

interface EditorShellProps {
  readOnly?: boolean;
  initialDiagramType?: 'bpmn' | 'erd';
  attachmentSlot?: PropertiesPanelProps['attachmentSlot'];
  attachmentEligibleTypes?: string[];
  onSelectionChange?: (node: SelectedNode | null) => void;
}

function EditorShell({
  readOnly = false,
  initialDiagramType,
  attachmentSlot,
  attachmentEligibleTypes,
  onSelectionChange,
}: EditorShellProps) {
  const api = useApiConfig();
  const [files, setFiles] = useState<DiagramFile[]>([]);
  const [openTabs, setOpenTabs] = useState<DiagramFile[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [sourceText, setSourceText] = useState<string>('');
  const canvasRef = useRef<CanvasHandles | null>(null);
  const { activeTool, setActiveTool, selectedNode, setSelectedNode, codePanelOpen, setCommandPaletteOpen, toggleCodePanel } =
    useToolStore();
  const history = useHistory<Record<string, { x: number; y: number }>>();

  useEffect(() => {
    onSelectionChange?.(selectedNode);
  }, [selectedNode, onSelectionChange]);

  // Load available files
  useEffect(() => {
    if (!api.endpoints.filesList) {
      // Hub mode — files are implicit from the active workspace. Seed a
      // single synthetic entry so the editor can mount its canvas.
      const synthetic: DiagramFile[] = [
        {
          name: initialDiagramType === 'erd' ? 'schema' : 'process',
          path: initialDiagramType === 'erd' ? 'schema.dbml' : 'process.bpmn.json',
          type: initialDiagramType ?? 'bpmn',
        },
      ];
      setFiles(synthetic);
      setOpenTabs(synthetic);
      setActiveTab(synthetic[0].path);
      return;
    }
    fetch(api.endpoints.filesList)
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
  }, [api, initialDiagramType]);

  const activeFile = openTabs.find((t) => t.path === activeTab) ?? null;
  const diagramType = activeFile?.type ?? null;

  // Load source when CodePanel opens or active file changes
  useEffect(() => {
    if (!codePanelOpen || !activeFile) return;
    const url = activeFile.type === 'bpmn' ? api.endpoints.bpmnSource : api.endpoints.erdSource;
    fetch(url)
      .then((r) => r.text())
      .then(setSourceText)
      .catch(console.error);
  }, [codePanelOpen, activeFile, api]);

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

      let body: Blob;
      const filename = `${activeFile.name}.${format}`;
      const authHeaders = api.endpoints.authHeader
        ? { Authorization: api.endpoints.authHeader }
        : undefined;
      const hubPutUrl = activeFile.type === 'bpmn' ? api.endpoints.bpmnPut : api.endpoints.erdPut;

      if (format === 'json') {
        const text = await handles.refreshSource();
        body = new Blob([text], { type: 'application/json' });
      } else if (format === 'dbml') {
        // Raw DBML source is the active file for ERD — matches what the adapter would send.
        const text = await handles.refreshSource();
        body = new Blob([text], { type: 'text/plain' });
      } else if (format === 'mermaid') {
        if (!hubPutUrl) {
          window.alert('Mermaid export requires the HTTP adapter. Run `viso-mcp http` or configure `apiBaseUrl`.');
          return;
        }
        const res = await fetch(`${hubPutUrl}/export?format=mermaid`, authHeaders ? { headers: authHeaders } : undefined);
        if (!res.ok) {
          window.alert(`Mermaid export failed: ${res.status} ${res.statusText}`);
          return;
        }
        body = new Blob([await res.text()], { type: 'text/plain' });
      } else if (format === 'sql') {
        if (!api.endpoints.erdPut) {
          window.alert('SQL export requires the HTTP adapter. Run `viso-mcp http` or configure `apiBaseUrl`.');
          return;
        }
        const res = await fetch(
          `${api.endpoints.erdPut}/export?format=sql&dialect=postgres`,
          authHeaders ? { headers: authHeaders } : undefined
        );
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          window.alert(`SQL export failed: ${res.status} ${res.statusText}\n${detail}`);
          return;
        }
        body = new Blob([await res.text()], { type: 'text/plain' });
      } else if (format === 'svg' || format === 'png') {
        window.alert(`${format.toUpperCase()} export is scheduled for Phase 6 (requires canvas snapshotting).`);
        return;
      } else {
        const text = await handles.refreshSource();
        body = new Blob([text], { type: 'text/plain' });
      }

      const a = document.createElement('a');
      a.href = URL.createObjectURL(body);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    },
    [activeFile, api]
  );

  const handleSaveSource = useCallback(
    async (next: string) => {
      if (readOnly) return;
      await canvasRef.current?.putSource(next);
    },
    [readOnly]
  );

  const handleUpdateNode = useCallback(
    async (id: string, update: NodeUpdate) => {
      if (readOnly) return;
      if (!activeFile || activeFile.type !== 'bpmn') {
        // ERD node edits land in a later phase (needs DBML mutation semantics).
        return;
      }
      const bpmnPutUrl = api.endpoints.bpmnPut;
      if (!bpmnPutUrl) {
        // Preview (Vite) mode — fall back to /bpmn/source round-trip via
        // the existing raw-source PUT so iterative editing still works.
        const handles = canvasRef.current;
        if (!handles) return;
        const raw = await handles.refreshSource();
        const doc = JSON.parse(raw) as { nodes: Record<string, Record<string, unknown>>; flows: unknown[] };
        const node = doc.nodes[id];
        if (!node) return;
        if (update.label !== undefined) node.label = update.label;
        if (update.description !== undefined) {
          if (update.description === '') delete node.description;
          else node.description = update.description;
        }
        if (update.type !== undefined) node.type = update.type;
        if (update.color !== undefined) node.color = update.color;
        await handles.putSource(JSON.stringify(doc, null, 2));
        return;
      }
      // Hub mode — fetch, mutate, PUT. This is a read-modify-write cycle:
      // concurrent edits on the same BPMN will see last-write-wins.
      // Optimistic concurrency (ETag header) is Phase 6 work once two hub
      // users actually collaborate.
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (api.endpoints.authHeader) headers.Authorization = api.endpoints.authHeader;
      const currentRes = await fetch(
        api.endpoints.bpmnSchema,
        api.endpoints.authHeader ? { headers: { Authorization: api.endpoints.authHeader } } : undefined
      );
      if (!currentRes.ok) throw new Error(`Fetch BPMN failed: ${currentRes.status} ${currentRes.statusText}`);
      const raw = (await currentRes.json()) as { data?: Process } | Process;
      const processDoc: Process = 'data' in raw && raw.data ? raw.data : (raw as Process);
      const node = processDoc.nodes?.[id];
      if (!node) return;
      if (update.label !== undefined) node.label = update.label;
      if (update.description !== undefined) {
        if (update.description === '') delete node.description;
        else node.description = update.description;
      }
      if (update.type !== undefined) node.type = update.type as Process['nodes'][string]['type'];
      const putRes = await fetch(bpmnPutUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ process: processDoc }),
      });
      if (!putRes.ok) {
        const detail = await putRes
          .json()
          .then((body: { detail?: string; title?: string }) => body?.detail ?? body?.title ?? `${putRes.status}`)
          .catch(() => `${putRes.status} ${putRes.statusText}`);
        throw new Error(`PropertiesPanel save failed: ${detail}`);
      }
    },
    [activeFile, api, readOnly]
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

  const handleAddNodeAt = useCallback(
    async (type: 'start-event' | 'end-event' | 'task' | 'gateway', pos: { x: number; y: number }) => {
      if (readOnly) return;
      const handles = canvasRef.current;
      if (!handles) return;
      const raw = await handles.refreshSource();
      let doc: { nodes: Record<string, Record<string, unknown>>; flows: unknown[]; format?: string };
      try {
        doc = JSON.parse(raw);
      } catch {
        doc = { format: 'viso-bpmn-v1', nodes: {}, flows: [] };
      }
      if (!doc.nodes) doc.nodes = {};
      if (!doc.flows) doc.flows = [];
      const baseId = typePrefix(type);
      let suffix = 1;
      let id = `${baseId}_${suffix}`;
      while (doc.nodes[id]) {
        suffix += 1;
        id = `${baseId}_${suffix}`;
      }
      doc.nodes[id] = {
        type,
        label: defaultLabel(type),
        ...(type === 'gateway' ? { gatewayType: 'exclusive' } : {}),
      };
      await handles.putSource(JSON.stringify(doc, null, 2));

      // Persist the clicked pane position so the new node lands where the
      // user clicked instead of at 0,0 from the ELK pass.  The positions
      // sidecar only exists in Vite mode (`/__viso-api/bpmn/positions`);
      // hub adapters don't surface it yet, so skip the write and let ELK
      // place the node on next load.
      const isVitePositions = api.endpoints.bpmnPositions.startsWith('/__viso-api/');
      if (isVitePositions) {
        try {
          const posUrl = api.endpoints.bpmnPositions;
          const current = await fetch(posUrl).then((r) => (r.ok ? r.json() : {}));
          await fetch(posUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...current, [id]: pos }),
          });
        } catch {
          /* positions are a nice-to-have; ELK will reflow on next load */
        }
      }

      // Reset the tool so subsequent clicks don't keep spawning nodes.
      setActiveTool('pointer');
    },
    [readOnly, api, setActiveTool]
  );

  const bpmnPaneClick = useMemo(() => {
    if (readOnly) return undefined;
    if (activeTool === 'start-event' || activeTool === 'end-event' || activeTool === 'task' || activeTool === 'gateway') {
      return (pos: { x: number; y: number }) => handleAddNodeAt(activeTool, pos);
    }
    return undefined;
  }, [activeTool, handleAddNodeAt, readOnly]);

  const actions = useMemo(
    () =>
      buildDefaultActions({
        onAddNode: (type) => {
          if (type === 'start-event' || type === 'end-event' || type === 'task' || type === 'gateway') {
            setActiveTool(type);
          }
        },
        onExport: handleExport,
        onToggleCode: toggleCodePanel,
        onAutoLayout: handleAutoLayout,
        onUndo: handleUndo,
        onRedo: handleRedo,
        onSwitchDiagram: files.length > 1 ? () => setCommandPaletteOpen(true) : undefined,
      }),
    [handleExport, toggleCodePanel, handleAutoLayout, handleUndo, handleRedo, files.length, setCommandPaletteOpen, setActiveTool]
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
              <BpmnCanvas canvasRef={canvasRef} onSelect={setSelectedNode} onPaneClick={bpmnPaneClick} />
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
          onUpdateNode={readOnly ? undefined : handleUpdateNode}
          attachmentSlot={attachmentSlot}
          attachmentEligibleTypes={attachmentEligibleTypes}
        />
      </div>
      <FooterBar />
      <CommandPalette diagramType={diagramType} actions={actions} />
    </div>
  );
}

function bpmnExportBase(bpmnPut: string | null): string {
  // Hub mode PUT url is `…/workspace/:id/bpmn`; export endpoint is sibling.
  if (!bpmnPut) return '';
  return `${bpmnPut}/export`;
}

function erdExportBase(erdPut: string | null): string {
  if (!erdPut) return '';
  return `${erdPut}/export`;
}

function typePrefix(type: 'start-event' | 'end-event' | 'task' | 'gateway'): string {
  switch (type) {
    case 'start-event':
      return 'start';
    case 'end-event':
      return 'end';
    case 'task':
      return 'task';
    case 'gateway':
      return 'gateway';
  }
}

function defaultLabel(type: 'start-event' | 'end-event' | 'task' | 'gateway'): string {
  switch (type) {
    case 'start-event':
      return 'Start';
    case 'end-event':
      return 'End';
    case 'task':
      return 'Neuer Task';
    case 'gateway':
      return 'Entscheidung?';
  }
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

export { EditorShell };
export type { EditorShellProps };
