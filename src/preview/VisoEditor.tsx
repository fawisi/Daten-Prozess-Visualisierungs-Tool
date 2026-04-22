import React from 'react';
import { TooltipProvider } from './components/ui/tooltip.js';
import { ToolStoreProvider, type SelectedNode } from './state/useToolStore.js';
import { ApiConfigProvider } from './state/ApiConfig.js';
import { EditorShell } from './App.js';

export interface VisoEditorProps {
  /**
   * Path or URL to a BPMN `.bpmn.json` file. When consuming the HTTP
   * adapter, the path is resolved server-side via the workspace resolver;
   * the prop is advisory for UI labels.
   */
  bpmnFile?: string;
  /** Path or URL to a DBML / ERD file. Same resolution as {@link bpmnFile}. */
  dbmlFile?: string;
  /** Force read-only mode: no mutations, no auto-save, PropertiesPanel disabled. */
  readOnly?: boolean;
  /** Hub workspace id — appended to {@link apiBaseUrl}/workspace/:id/... */
  workspaceId?: string;
  /** Optional bearer token forwarded to the adapter on every call. */
  authToken?: string;
  /**
   * Base URL for the viso-mcp HTTP adapter. When set together with
   * {@link workspaceId}, the editor talks to `${apiBaseUrl}/workspace/:id/bpmn`
   * and friends. Default falls back to the Vite plugin endpoints
   * (`/__viso-api/*`).
   */
  apiBaseUrl?: string;
  /**
   * Render-prop injected into the `PropertiesPanel` when a node of an
   * eligible type is selected. Hub-owned components (e.g. the TAFKA
   * screen-recording attachment) hook in here without viso-mcp growing
   * a hard dependency.
   */
  attachmentSlot?: (ctx: {
    nodeId: string;
    nodeType: string;
    diagramType: 'bpmn' | 'erd';
  }) => React.ReactNode;
  /** Node/table types that render the attachment slot; default `['task', 'table']`. */
  attachmentEligibleTypes?: string[];
  /** Pick which diagram the shell opens with when the file list is unavailable. */
  initialDiagramType?: 'bpmn' | 'erd';
  /** Called with the current selection; `null` when nothing is selected. */
  onSelectionChange?: (node: SelectedNode | null) => void;
  /** Extra className for the root wrapper; use to constrain height in Next.js pages. */
  className?: string;
}

/**
 * Full-fidelity viso-mcp editor embeddable in any React 19 host.
 *
 * Next.js 16 App Router usage:
 * ```tsx
 * 'use client';
 * import { VisoEditor } from 'viso-mcp/preview';
 *
 * <VisoEditor
 *   workspaceId={params.id}
 *   apiBaseUrl={`/api/proxy/viso/${params.id}`}
 *   attachmentSlot={(ctx) => <ScreenRecordingSlot {...ctx} />}
 * />
 * ```
 */
export function VisoEditor({
  workspaceId,
  authToken,
  apiBaseUrl,
  readOnly,
  attachmentSlot,
  attachmentEligibleTypes,
  initialDiagramType,
  onSelectionChange,
  className,
}: VisoEditorProps) {
  return (
    <ApiConfigProvider
      apiBaseUrl={apiBaseUrl}
      workspaceId={workspaceId}
      authToken={authToken}
    >
      <TooltipProvider>
        <ToolStoreProvider>
          <div className={className ?? 'h-full w-full'}>
            <EditorShell
              readOnly={readOnly}
              attachmentSlot={attachmentSlot}
              attachmentEligibleTypes={attachmentEligibleTypes}
              initialDiagramType={initialDiagramType}
              onSelectionChange={onSelectionChange}
            />
          </div>
        </ToolStoreProvider>
      </TooltipProvider>
    </ApiConfigProvider>
  );
}
