import React from 'react';
import { MousePointer2, Hand, Circle, Square, Diamond, CircleDot } from 'lucide-react';
import { useToolStore, type Tool } from '@/state/useToolStore.js';
import { useI18n } from '@/i18n/useI18n.js';
import { usePaletteDrag } from '@/hooks/usePaletteDrag.js';
import { cn } from '@/lib/utils.js';

interface ToolDef {
  id: Tool;
  translationKey: 'pointer' | 'pan' | 'start_event' | 'end_event' | 'task' | 'gateway';
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'cursor' | 'shape';
  diagramType?: 'bpmn' | 'erd';
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
  diagramType: 'bpmn' | 'erd' | null;
}

export function ToolPalette({ diagramType }: ToolPaletteProps) {
  const { activeTool, setActiveTool } = useToolStore();
  const { t } = useI18n();

  const visibleTools = TOOLS.filter(
    (tool) => !tool.diagramType || tool.diagramType === diagramType
  );

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
