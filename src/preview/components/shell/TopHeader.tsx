import React, { useState } from 'react';
import { Button } from '@/components/ui/button.js';
import { Code2, Download, FileJson, Wand2, Moon, Sun } from 'lucide-react';
import { useToolStore } from '@/state/useToolStore.js';
import { useTheme } from '@/state/useTheme.js';

export type ExportFormat = 'mermaid' | 'sql' | 'dbml' | 'svg' | 'png';

interface TopHeaderProps {
  fileName: string | null;
  badge?: string;
  onAutoLayout: () => void;
  onExport: (format: ExportFormat) => void;
}

const EXPORT_OPTIONS: { id: ExportFormat; label: string; hint: string }[] = [
  { id: 'mermaid', label: 'Mermaid', hint: '.md' },
  { id: 'sql', label: 'SQL DDL', hint: '.sql' },
  { id: 'dbml', label: 'DBML', hint: '.dbml' },
  { id: 'svg', label: 'SVG', hint: '.svg' },
  { id: 'png', label: 'PNG', hint: '.png' },
];

export function TopHeader({ fileName, badge, onAutoLayout, onExport }: TopHeaderProps) {
  const { codePanelOpen, toggleCodePanel } = useToolStore();
  const { resolved, toggle } = useTheme();
  const [exportOpen, setExportOpen] = useState(false);

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
            {fileName ?? 'viso-mcp'}
          </span>
          {badge && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-wide shrink-0">
              {badge}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={onAutoLayout}
          className="h-8 gap-1.5"
          title="Auto-Layout (ELK)"
        >
          <Wand2 className="h-3.5 w-3.5" />
          Auto-Layout
        </Button>
        <Button
          variant={codePanelOpen ? 'secondary' : 'outline'}
          size="sm"
          onClick={toggleCodePanel}
          className="h-8 gap-1.5 font-mono"
          title="Toggle Code Panel (Cmd+/)"
          aria-pressed={codePanelOpen}
        >
          <Code2 className="h-3.5 w-3.5" />
          Code
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={toggle}
          className="h-8 w-8 p-0"
          title={resolved === 'dark' ? 'Zu Light Mode wechseln' : 'Zu Dark Mode wechseln'}
          aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
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
            title="Export"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          {exportOpen && (
            <div className="absolute right-0 top-9 z-40 min-w-[160px] rounded-md border bg-popover shadow-md overflow-hidden">
              {EXPORT_OPTIONS.map((opt) => (
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
                    {opt.label}
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
