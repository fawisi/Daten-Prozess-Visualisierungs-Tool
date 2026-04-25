import React, { useEffect } from 'react';
import { Command } from 'cmdk';
import {
  Circle,
  CircleDot,
  Square,
  Diamond,
  Code2,
  Wand2,
  Download,
  FileJson,
  Undo2,
  Redo2,
  Files,
} from 'lucide-react';
import { useToolStore } from '@/state/useToolStore.js';
import type { DiagramType } from '../../../types.js';

export interface CommandAction {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  group: string;
  when?: DiagramType | 'any';
  run: () => void;
}

interface CommandPaletteProps {
  diagramType: DiagramType | null;
  actions: CommandAction[];
}

export function CommandPalette({ diagramType, actions }: CommandPaletteProps) {
  const { commandPaletteOpen, setCommandPaletteOpen } = useToolStore();

  // Close on route / focus change — handled by Escape in store already.
  useEffect(() => {
    if (!commandPaletteOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [commandPaletteOpen]);

  if (!commandPaletteOpen) return null;

  const visible = actions.filter((a) => !a.when || a.when === 'any' || a.when === diagramType);
  const grouped = visible.reduce<Record<string, CommandAction[]>>((acc, a) => {
    (acc[a.group] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/40 backdrop-blur-sm"
      onClick={() => setCommandPaletteOpen(false)}
      role="presentation"
    >
      <div
        className="w-full max-w-xl mx-4 rounded-lg border bg-popover text-popover-foreground shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <Command loop>
          <Command.Input
            autoFocus
            placeholder="Type a command or search…"
            className="w-full h-12 px-4 border-b bg-transparent outline-none text-sm"
          />
          <Command.List className="max-h-[50vh] overflow-y-auto py-2">
            <Command.Empty className="px-4 py-6 text-sm text-muted-foreground text-center">
              No matching commands.
            </Command.Empty>
            {Object.entries(grouped).map(([group, items]) => (
              <Command.Group
                key={group}
                heading={group}
                className="px-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {items.map((a) => {
                  const Icon = a.icon;
                  return (
                    <Command.Item
                      key={a.id}
                      value={`${a.label} ${a.hint ?? ''}`}
                      onSelect={() => {
                        a.run();
                        setCommandPaletteOpen(false);
                      }}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md cursor-pointer data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                    >
                      <span className="flex items-center gap-2.5">
                        {Icon && <Icon className="h-4 w-4 opacity-70" />}
                        <span>{a.label}</span>
                        {a.hint && (
                          <span className="text-muted-foreground text-xs">{a.hint}</span>
                        )}
                      </span>
                      {a.shortcut && (
                        <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-muted">
                          {a.shortcut}
                        </kbd>
                      )}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

// Helper for callers to build default action sets
export function buildDefaultActions(opts: {
  onAddNode: (type: 'start-event' | 'end-event' | 'task' | 'gateway') => void;
  onExport: (format: 'mermaid' | 'sql' | 'dbml' | 'svg' | 'png') => void;
  onToggleCode: () => void;
  onAutoLayout: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSwitchDiagram?: () => void;
}): CommandAction[] {
  return [
    {
      id: 'add-start',
      label: 'Add Start Event',
      group: 'BPMN',
      icon: Circle,
      shortcut: '1',
      when: 'bpmn',
      run: () => opts.onAddNode('start-event'),
    },
    {
      id: 'add-end',
      label: 'Add End Event',
      group: 'BPMN',
      icon: CircleDot,
      shortcut: '2',
      when: 'bpmn',
      run: () => opts.onAddNode('end-event'),
    },
    {
      id: 'add-task',
      label: 'Add Task',
      group: 'BPMN',
      icon: Square,
      shortcut: '3',
      when: 'bpmn',
      run: () => opts.onAddNode('task'),
    },
    {
      id: 'add-gateway',
      label: 'Add Gateway',
      group: 'BPMN',
      icon: Diamond,
      shortcut: '4',
      when: 'bpmn',
      run: () => opts.onAddNode('gateway'),
    },
    {
      id: 'auto-layout',
      label: 'Run Auto-Layout',
      group: 'View',
      icon: Wand2,
      when: 'any',
      run: opts.onAutoLayout,
    },
    {
      id: 'toggle-code',
      label: 'Toggle Code Panel',
      group: 'View',
      icon: Code2,
      shortcut: '⌘ /',
      when: 'any',
      run: opts.onToggleCode,
    },
    {
      id: 'undo',
      label: 'Undo',
      group: 'Edit',
      icon: Undo2,
      shortcut: '⌘ Z',
      when: 'any',
      run: opts.onUndo,
    },
    {
      id: 'redo',
      label: 'Redo',
      group: 'Edit',
      icon: Redo2,
      shortcut: '⌘ ⇧ Z',
      when: 'any',
      run: opts.onRedo,
    },
    {
      id: 'export-mermaid',
      label: 'Export as Mermaid',
      group: 'Export',
      icon: FileJson,
      when: 'any',
      run: () => opts.onExport('mermaid'),
    },
    {
      id: 'export-sql',
      label: 'Export as SQL DDL',
      group: 'Export',
      icon: Download,
      when: 'erd',
      run: () => opts.onExport('sql'),
    },
    {
      id: 'export-dbml',
      label: 'Export as DBML',
      group: 'Export',
      icon: FileJson,
      when: 'erd',
      run: () => opts.onExport('dbml'),
    },
    ...(opts.onSwitchDiagram
      ? [
          {
            id: 'switch-diagram',
            label: 'Switch Diagram…',
            group: 'Navigation',
            icon: Files,
            when: 'any' as const,
            run: opts.onSwitchDiagram,
          },
        ]
      : []),
  ];
}
