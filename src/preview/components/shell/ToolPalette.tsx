import React from 'react';
import { MousePointer2, Hand, Circle, Square, Diamond, CircleDot, Table2, User, Box, ExternalLink, Container, Database } from 'lucide-react';
import { useToolStore, type Tool } from '@/state/useToolStore.js';
import { useI18n } from '@/i18n/useI18n.js';
import { usePaletteDrag } from '@/hooks/usePaletteDrag.js';
import { cn } from '@/lib/utils.js';
import type { DiagramType } from '../../../types.js';

type ToolTranslationKey =
  | 'pointer' | 'pan'
  | 'start_event' | 'end_event' | 'task' | 'gateway'
  | 'table'
  | 'lc_person' | 'lc_system' | 'lc_external' | 'lc_container' | 'lc_database';

interface ToolDef {
  id: Tool;
  translationKey: ToolTranslationKey;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'cursor' | 'shape';
  diagramType?: DiagramType;
  /**
   * When set, the tool is hidden in `simple` process mode. Today all
   * BPMN v1.0 elements are simple-mode-safe, but once inclusive / parallel
   * gateways + timer events land this flag scopes them to `bpmn`-mode
   * only (plan P1 Deliverable-2).
   */
  bpmnOnly?: boolean;
}

const TOOLS: ToolDef[] = [
  { id: 'pointer', translationKey: 'pointer', shortcut: 'V', icon: MousePointer2, group: 'cursor' },
  { id: 'pan', translationKey: 'pan', shortcut: 'H', icon: Hand, group: 'cursor' },
  { id: 'start-event', translationKey: 'start_event', shortcut: '1', icon: Circle, group: 'shape', diagramType: 'bpmn' },
  { id: 'end-event', translationKey: 'end_event', shortcut: '2', icon: CircleDot, group: 'shape', diagramType: 'bpmn' },
  { id: 'task', translationKey: 'task', shortcut: '3', icon: Square, group: 'shape', diagramType: 'bpmn' },
  { id: 'gateway', translationKey: 'gateway', shortcut: '4', icon: Diamond, group: 'shape', diagramType: 'bpmn' },
];

interface ToolPaletteProps {
  diagramType: DiagramType | null;
}

export function ToolPalette({ diagramType }: ToolPaletteProps) {
  const { activeTool, setActiveTool, processMode } = useToolStore();
  const { t } = useI18n();

  const visibleTools = TOOLS.filter((tool) => {
    if (tool.diagramType && tool.diagramType !== diagramType) return false;
    // In simple mode, BPMN-only tools disappear from the palette — the
    // nodes themselves stay in the schema (nondestructive downgrade),
    // they just can't be freshly placed until the user switches back to
    // full BPMN mode (plan P1 Deliverable-2).
    if (tool.bpmnOnly && processMode === 'simple') return false;
    return true;
  });

  const cursorTools = visibleTools.filter((tool) => tool.group === 'cursor');
  const shapeTools = visibleTools.filter((tool) => tool.group === 'shape');

  return (
    <aside
      className="w-[68px] shrink-0 border-r bg-background/80 flex flex-col items-center py-3 gap-1"
      aria-label="Tool Palette"
    >
      {cursorTools.map((tool) => (
        <ToolButton
          key={tool.id}
          tool={tool}
          label={t.toolPalette[tool.translationKey]}
          active={activeTool === tool.id}
          onClick={() => setActiveTool(tool.id)}
        />
      ))}

      {shapeTools.length > 0 && <div className="w-8 h-px bg-border my-2" />}

      {shapeTools.map((tool) => (
        <ToolButton
          key={tool.id}
          tool={tool}
          label={t.toolPalette[tool.translationKey]}
          active={activeTool === tool.id}
          onClick={() => setActiveTool(tool.id)}
        />
      ))}
    </aside>
  );
}

interface ToolButtonProps {
  tool: ToolDef;
  label: string;
  active: boolean;
  onClick: () => void;
}

function ToolButton({ tool, label, active, onClick }: ToolButtonProps) {
  const Icon = tool.icon;
  // Only shape tools spawn nodes; cursor/pan tools skip the drag wiring.
  const isShape = tool.group === 'shape';
  const dragHandlers = usePaletteDrag(tool.id);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} (${tool.shortcut})`}
      aria-pressed={active}
      title={`${label} — ${tool.shortcut}`}
      onPointerDown={isShape ? dragHandlers.onPointerDown : undefined}
      onPointerMove={isShape ? dragHandlers.onPointerMove : undefined}
      onPointerUp={isShape ? dragHandlers.onPointerUp : undefined}
      onPointerCancel={isShape ? dragHandlers.onPointerCancel : undefined}
      className={cn(
        'group relative size-11 rounded-md flex items-center justify-center transition-colors touch-none',
        active
          ? 'bg-primary/15 text-primary ring-1 ring-primary/50'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="absolute bottom-0.5 right-0.5 text-[9px] font-mono text-muted-foreground/60 leading-none">
        {tool.shortcut}
      </span>
    </button>
  );
}
