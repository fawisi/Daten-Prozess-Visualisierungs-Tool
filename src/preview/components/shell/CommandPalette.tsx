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
  Table2,
  User,
  Box,
  ExternalLink,
  Container,
  Database,
  Image,
  FileImage,
  Archive,
} from 'lucide-react';
import type { Tool } from '../../state/useToolStore.js';
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
  onAddNode: (type: Tool) => void;
  onExport: (format: 'mermaid' | 'sql' | 'dbml' | 'svg' | 'png' | 'bundle') => void;
  onToggleCode: () => void;
  onAutoLayout: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSwitchDiagram?: () => void;
}): CommandAction[] {
  return [
    // ===== BPMN-Add (Shortcut 1-4) =====
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
    // ===== ERD-Add (v1.1.1 — CR-2): Shortcut 5 =====
    {
      id: 'add-table',
      label: 'Add Table',
      hint: 'Tabelle hinzufuegen',
      group: 'ERD',
      icon: Table2,
      shortcut: '5',
      when: 'erd',
      run: () => opts.onAddNode('table'),
    },
    // ===== Landscape-Add (v1.1.1 — CR-3): Shortcut 6-9, 0 =====
    {
      id: 'add-lc-person',
      label: 'Add Person',
      hint: 'Personen-Aktor',
      group: 'Landscape',
      icon: User,
      shortcut: '6',
      when: 'landscape',
      run: () => opts.onAddNode('lc-person'),
    },
    {
      id: 'add-lc-system',
      label: 'Add System',
      hint: 'Internes System',
      group: 'Landscape',
      icon: Box,
      shortcut: '7',
      when: 'landscape',
      run: () => opts.onAddNode('lc-system'),
    },
    {
      id: 'add-lc-external',
      label: 'Add External System',
      hint: 'Externer Dienst (z.B. Stripe)',
      group: 'Landscape',
      icon: ExternalLink,
      shortcut: '8',
      when: 'landscape',
      run: () => opts.onAddNode('lc-external'),
    },
    {
      id: 'add-lc-container',
      label: 'Add Container',
      hint: 'Container (z.B. Backend)',
      group: 'Landscape',
      icon: Container,
      shortcut: '9',
      when: 'landscape',
      run: () => opts.onAddNode('lc-container'),
    },
    {
      id: 'add-lc-database',
      label: 'Add Database',
      hint: 'Datenbank',
      group: 'Landscape',
      icon: Database,
      shortcut: '0',
      when: 'landscape',
      run: () => opts.onAddNode('lc-database'),
    },
    // ===== View =====
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
    // ===== Edit =====
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
    // ===== Export (v1.1.1 — CR-7: Single Source of Truth, identische Liste wie Header-Dropdown) =====
    {
      id: 'export-bundle',
      label: 'Export Handoff-Bundle',
      hint: '.zip',
      group: 'Export',
      icon: Archive,
      when: 'any',
      run: () => opts.onExport('bundle'),
    },
    {
      id: 'export-mermaid',
      label: 'Export as Mermaid',
      hint: '.md',
      group: 'Export',
      icon: FileJson,
      when: 'any',
      run: () => opts.onExport('mermaid'),
    },
    {
      id: 'export-sql',
      label: 'Export as SQL DDL',
      hint: '.sql',
      group: 'Export',
      icon: Download,
      when: 'erd',
      run: () => opts.onExport('sql'),
    },
    {
      id: 'export-dbml',
      label: 'Export as DBML',
      hint: '.dbml',
      group: 'Export',
      icon: FileJson,
      when: 'erd',
      run: () => opts.onExport('dbml'),
    },
    {
      id: 'export-svg',
      label: 'Export as SVG',
      hint: '.svg',
      group: 'Export',
      icon: Image,
      when: 'any',
      run: () => opts.onExport('svg'),
    },
    {
      id: 'export-png',
      label: 'Export as PNG',
      hint: '.png',
      group: 'Export',
      icon: FileImage,
      when: 'any',
      run: () => opts.onExport('png'),
    },
    // ===== Navigation =====
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
