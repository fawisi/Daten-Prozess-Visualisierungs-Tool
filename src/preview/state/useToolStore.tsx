import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { ProcessMode } from '../../bpmn/mode-heuristic.js';
import type { DiagramType, Tool } from '../../types.js';

// Re-Exports: Stelle ist historisch importiert worden (App.tsx, Canvas-Komponenten).
// Single Source of Truth liegt jetzt in src/types.ts (Plan v1.1.1 AD-1).
export type { DiagramType, Tool };

// Re-export so call sites can import from one place; the type itself
// is declared alongside the heuristic that produces it (kieran N4).
export type { ProcessMode };

/**
 * C4-style detail level for the system landscape (MA-10 — v1.1.2).
 * `l1` shows people + systems; `l2` zooms into a single system's
 * containers + databases. Persisted via the landscape mode sidecar
 * (`*.landscape.mode.json`).
 */
export type LandscapeMode = 'l1' | 'l2';

export interface SelectedNode {
  id: string;
  type: string;
  diagramType: DiagramType;
  data: Record<string, unknown>;
}

interface ToolStoreValue {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  selectedNode: SelectedNode | null;
  setSelectedNode: (node: SelectedNode | null) => void;
  codePanelOpen: boolean;
  toggleCodePanel: () => void;
  setCodePanelOpen: (open: boolean) => void;
  commandPaletteOpen: boolean;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  processMode: ProcessMode;
  setProcessMode: (mode: ProcessMode) => void;
  landscapeMode: LandscapeMode;
  setLandscapeMode: (mode: LandscapeMode) => void;
}

const ToolStoreContext = createContext<ToolStoreValue | null>(null);

const TOOL_SHORTCUTS: Record<string, Tool> = {
  v: 'pointer',
  h: 'pan',
  // BPMN
  '1': 'start-event',
  '2': 'end-event',
  '3': 'task',
  '4': 'gateway',
  // ERD (v1.1.1 — CR-2)
  '5': 'table',
  // Landscape (v1.1.1 — CR-3)
  '6': 'lc-person',
  '7': 'lc-system',
  '8': 'lc-external',
  '9': 'lc-container',
  '0': 'lc-database',
};

export function ToolStoreProvider({ children }: { children: React.ReactNode }) {
  const [activeTool, setActiveTool] = useState<Tool>('pointer');
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [codePanelOpen, setCodePanelOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  // Default to 'simple' — the canvas will replace this once the
  // /bpmn/mode sidecar is loaded (or the heuristic falls back for v1.0
  // files with BPMN-only elements).
  const [processMode, setProcessMode] = useState<ProcessMode>('simple');
  // Default to 'l1' — Vite-plugin's /landscape/mode endpoint also
  // defaults there when no sidecar is present, so the UI matches the
  // server-side fallback (MA-10 — v1.1.2).
  const [landscapeMode, setLandscapeMode] = useState<LandscapeMode>('l1');

  const toggleCodePanel = useCallback(() => setCodePanelOpen((v) => !v), []);
  const toggleCommandPalette = useCallback(() => setCommandPaletteOpen((v) => !v), []);

  // Global keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable ||
        target?.closest('.cm-editor') !== null;

      // Cmd+K — Command palette (always, even in editable)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }

      // Cmd+/ — Code panel (always, even in editable)
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        toggleCodePanel();
        return;
      }

      // Escape — close palette / deselect
      if (e.key === 'Escape') {
        if (commandPaletteOpen) {
          setCommandPaletteOpen(false);
          return;
        }
        if (selectedNode) {
          setSelectedNode(null);
          return;
        }
      }

      if (isEditable) return;

      // Tool shortcuts (V, H, 1-4) — only when not editing text
      const lower = e.key.toLowerCase();
      if (TOOL_SHORTCUTS[lower]) {
        e.preventDefault();
        setActiveTool(TOOL_SHORTCUTS[lower]);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleCommandPalette, toggleCodePanel, commandPaletteOpen, selectedNode]);

  const value = useMemo<ToolStoreValue>(
    () => ({
      activeTool,
      setActiveTool,
      selectedNode,
      setSelectedNode,
      codePanelOpen,
      toggleCodePanel,
      setCodePanelOpen,
      commandPaletteOpen,
      toggleCommandPalette,
      setCommandPaletteOpen,
      processMode,
      setProcessMode,
      landscapeMode,
      setLandscapeMode,
    }),
    [
      activeTool,
      selectedNode,
      codePanelOpen,
      commandPaletteOpen,
      toggleCodePanel,
      toggleCommandPalette,
      processMode,
      landscapeMode,
    ]
  );

  return <ToolStoreContext.Provider value={value}>{children}</ToolStoreContext.Provider>;
}

export function useToolStore(): ToolStoreValue {
  const ctx = useContext(ToolStoreContext);
  if (!ctx) {
    throw new Error('useToolStore must be used within a ToolStoreProvider');
  }
  return ctx;
}
