import React, { useState } from 'react';
import { Button } from '@/components/ui/button.js';
import { Code2, Download, FileJson, Wand2, Moon, Sun } from 'lucide-react';
import { useToolStore, type ProcessMode } from '@/state/useToolStore.js';
import { useTheme } from '@/state/useTheme.js';
import { useI18n } from '@/i18n/useI18n.js';
import { cn } from '@/lib/utils.js';

export type ExportFormat = 'mermaid' | 'sql' | 'dbml' | 'svg' | 'png' | 'bundle';

interface TopHeaderProps {
  fileName: string | null;
  badge?: string;
  onAutoLayout: () => void;
  onExport: (format: ExportFormat) => void;
  /** When set, renders the process-mode toggle (BPMN-only). Hidden for ERD files. */
  showModeToggle?: boolean;
  /**
   * Called with the new mode. Must return a Promise resolving to `true`
   * on successful persistence — the toggle will revert its optimistic
   * UI state to the previous mode on `false` so the UI never drifts
   * from disk (kieran-review P1 B2).
   */
  onModeChange?: (mode: ProcessMode) => Promise<boolean> | void;
  hiddenElementsCount?: number;
}

const EXPORT_OPTION_IDS: { id: ExportFormat; hint: string }[] = [
  { id: 'bundle', hint: '.zip' },
  { id: 'mermaid', hint: '.md' },
  { id: 'sql', hint: '.sql' },
  { id: 'dbml', hint: '.dbml' },
  { id: 'svg', hint: '.svg' },
  { id: 'png', hint: '.png' },
];

export function TopHeader({
  fileName,
  badge,
  onAutoLayout,
  onExport,
  showModeToggle = false,
  onModeChange,
  hiddenElementsCount = 0,
}: TopHeaderProps) {
  const { codePanelOpen, toggleCodePanel, processMode, setProcessMode } = useToolStore();
  const { resolved, toggle } = useTheme();
  const { t } = useI18n();
  const [exportOpen, setExportOpen] = useState(false);

  async function handleModeChange(next: ProcessMode) {
    const previous = processMode;
    setProcessMode(next); // optimistic — snaps back below on PUT failure
    const result = onModeChange?.(next);
    if (result instanceof Promise) {
      const ok = await result;
      if (!ok) setProcessMode(previous);
    }
  }

  return (
    <header
      className="flex items-center justify-between h-12 px-3 border-b bg-background/60 backdrop-blur"
      role="banner"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center justify-center w-7 h-7 rounded bg-primary text-primary-foreground font-mono text-sm font-bold shrink-0">
          v
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-sm font-semibold truncate">
            {fileName ?? t.topHeader.app_name}
          </span>
          {badge && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-wide shrink-0">
              {badge}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {showModeToggle && (
          <div
            role="radiogroup"
            aria-label={t.topHeader.mode_toggle_aria}
            className="flex items-center h-8 rounded-md border bg-background p-0.5"
          >
            <ModeSegment
              active={processMode === 'simple'}
              label={t.topHeader.mode_simple}
              onClick={() => handleModeChange('simple')}
            />
            <ModeSegment
              active={processMode === 'bpmn'}
              label={t.topHeader.mode_bpmn}
              onClick={() => handleModeChange('bpmn')}
            />
            {processMode === 'simple' && hiddenElementsCount > 0 && (
              <span
                className="ml-1 mr-1 rounded-full bg-amber-500/15 text-amber-600 text-[10px] font-medium px-1.5 py-0.5"
                title={t.topHeader.mode_hidden_hint({ count: hiddenElementsCount })}
              >
                {hiddenElementsCount}
              </span>
            )}
          </div>
        )}
        <Button
          variant="default"
          size="sm"
          onClick={onAutoLayout}
          className="h-8 gap-1.5"
          title={t.topHeader.auto_layout_title}
        >
          <Wand2 className="h-3.5 w-3.5" />
          {t.topHeader.auto_layout}
        </Button>
        <Button
          variant={codePanelOpen ? 'secondary' : 'outline'}
          size="sm"
          onClick={toggleCodePanel}
          className="h-8 gap-1.5 font-mono"
          title={t.topHeader.code_title}
          aria-pressed={codePanelOpen}
        >
          <Code2 className="h-3.5 w-3.5" />
          {t.topHeader.code}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={toggle}
          className="h-8 w-8 p-0"
          title={resolved === 'dark' ? t.topHeader.theme_switch_light : t.topHeader.theme_switch_dark}
          aria-label={resolved === 'dark' ? t.topHeader.theme_switch_light : t.topHeader.theme_switch_dark}
          data-compact
        >
          {resolved === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </Button>
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportOpen((v) => !v)}
            onBlur={() => setTimeout(() => setExportOpen(false), 150)}
            className="h-8 gap-1.5"
            title={t.topHeader.export}
          >
            <Download className="h-3.5 w-3.5" />
            {t.topHeader.export}
          </Button>
          {exportOpen && (
            <div className="absolute right-0 top-9 z-40 min-w-[160px] rounded-md border bg-popover shadow-md overflow-hidden">
              {EXPORT_OPTION_IDS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onExport(opt.id);
                    setExportOpen(false);
                  }}
                  className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-mono hover:bg-accent hover:text-accent-foreground text-left"
                >
                  <span className="flex items-center gap-2">
                    <FileJson className="h-3 w-3 opacity-60" />
                    {t.export[opt.id]}
                  </span>
                  <span className="text-muted-foreground">{opt.hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function ModeSegment({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'h-7 px-2.5 rounded text-xs font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
    </button>
  );
}
