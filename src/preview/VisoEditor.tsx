import React from 'react';
import { TooltipProvider } from './components/ui/tooltip.js';
import { ToolStoreProvider, type SelectedNode } from './state/useToolStore.js';
import { ApiConfigProvider } from './state/ApiConfig.js';
import { ThemeProvider } from './state/useTheme.js';
import { I18nProvider, type Locale } from './i18n/useI18n.js';
import { EditorShell } from './App.js';

export interface VisoEditorProps {
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
    diagramType: 'bpmn' | 'erd' | 'landscape';
  }) => React.ReactNode;
  /** Node/table types that render the attachment slot; default `['task', 'table']`. */
  attachmentEligibleTypes?: string[];
  /** Pick which diagram the shell opens with when the file list is unavailable. */
  initialDiagramType?: 'bpmn' | 'erd' | 'landscape';
  /** Called with the current selection; `null` when nothing is selected. */
  onSelectionChange?: (node: SelectedNode | null) => void;
  /** Extra className for the root wrapper; use to constrain height in Next.js pages. */
  className?: string;
  /**
   * When false, VisoEditor does NOT install its own ThemeProvider. Use
   * this if the hosting app already manages the `.dark` class on
   * `<html>`; otherwise the two providers will fight over the class.
   */
  manageTheme?: boolean;
  /**
   * Active UI locale. Default `'de'`. `'en'` ships with the same keys as
   * `de` in v1.1 and switches to the English dictionary once values are
   * populated. The persistent schema stays English-only (EN status enum,
   * EN export content).
   */
  locale?: Locale;
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
  manageTheme = true,
  locale = 'de',
}: VisoEditorProps) {
  const shell = (
    <ApiConfigProvider
      apiBaseUrl={apiBaseUrl}
      workspaceId={workspaceId}
      authToken={authToken}
    >
      <I18nProvider locale={locale}>
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
      </I18nProvider>
    </ApiConfigProvider>
  );
  return manageTheme ? <ThemeProvider>{shell}</ThemeProvider> : shell;
}
