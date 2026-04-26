import React, { useEffect, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input.js';
import { Button } from '@/components/ui/button.js';
import { useToolStore, type SelectedNode } from '@/state/useToolStore.js';
import { useI18n, type PersistentStatus } from '@/i18n/useI18n.js';
import { cn } from '@/lib/utils.js';
import type { Column } from '../../../schema.js';

const BPMN_TYPE_OPTIONS: { value: string; translationKey: keyof ReturnType<typeof useI18n>['t']['toolPalette'] }[] = [
  { value: 'start-event', translationKey: 'start_event' },
  { value: 'end-event', translationKey: 'end_event' },
  { value: 'task', translationKey: 'task' },
  { value: 'gateway', translationKey: 'gateway' },
];

const STATUS_OPTIONS: PersistentStatus[] = ['open', 'done', 'blocked'];

export interface NodeUpdate {
  label?: string;
  description?: string;
  type?: string;
  /**
   * @deprecated since v1.1 — free color-picker is removed in favour of
   *   `status`. Hub consumers that still send `color` can pass it; the
   *   server ignores it for rendering. Will be removed in v1.3.
   */
  color?: string;
  status?: PersistentStatus | null;
  /**
   * Full replacement of the columns array on an ERD table (MA-11). The
   * caller sends the entire desired list (no delta). Existing description
   * and status on each column survive the round-trip because the panel
   * keeps the full Column shape in its local state.
   */
  columns?: Column[];
}

export interface PropertiesPanelProps {
  diagramMeta?: {
    name?: string;
    format?: string;
    itemCount?: number;
    itemLabel?: string;
  };
  onUpdateNode?: (id: string, update: NodeUpdate) => void;
  attachmentSlot?: (ctx: {
    nodeId: string;
    nodeType: string;
    diagramType: 'bpmn' | 'erd' | 'landscape';
  }) => React.ReactNode;
  attachmentEligibleTypes?: string[];
}

export function PropertiesPanel({
  diagramMeta,
  onUpdateNode,
  attachmentSlot,
  attachmentEligibleTypes = ['task', 'table'],
}: PropertiesPanelProps) {
  const { selectedNode, setSelectedNode } = useToolStore();

  if (!selectedNode) {
    return <EmptyProperties meta={diagramMeta} />;
  }

  return (
    <NodeProperties
      node={selectedNode}
      onClose={() => setSelectedNode(null)}
      onUpdateNode={onUpdateNode}
      attachmentSlot={attachmentSlot}
      attachmentEligibleTypes={attachmentEligibleTypes}
    />
  );
}

interface NodePropertiesProps {
  node: SelectedNode;
  onClose: () => void;
  onUpdateNode?: (id: string, update: NodeUpdate) => void;
  attachmentSlot?: PropertiesPanelProps['attachmentSlot'];
  attachmentEligibleTypes: string[];
}

function NodeProperties({
  node,
  onClose,
  onUpdateNode,
  attachmentSlot,
  attachmentEligibleTypes,
}: NodePropertiesProps) {
  const { t, statusLabel } = useI18n();
  const rawLabel = (node.data.label as string | undefined) ?? node.id;
  const rawDescription = (node.data.description as string | undefined) ?? '';
  const rawNodeType = (node.data.nodeType as string | undefined) ?? node.type;
  const rawStatus =
    (node.data.status as PersistentStatus | undefined) ??
    ((node.data as { originalStatus?: PersistentStatus }).originalStatus ?? null);
  const rawColumns = (node.data.columns as Column[] | undefined) ?? [];

  const [label, setLabel] = useState(rawLabel);
  const [description, setDescription] = useState(rawDescription);
  const [nodeType, setNodeType] = useState(rawNodeType);
  const [status, setStatus] = useState<PersistentStatus | null>(rawStatus);
  const [columns, setColumns] = useState<Column[]>(rawColumns);

  // Reset state when selection changes. JSON-stringify the columns array
  // so the effect re-runs only when the actual content changes — useState
  // identity flips otherwise on every render.
  const columnsKey = JSON.stringify(rawColumns);
  useEffect(() => {
    setLabel(rawLabel);
    setDescription(rawDescription);
    setNodeType(rawNodeType);
    setStatus(rawStatus);
    setColumns(rawColumns);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, rawLabel, rawDescription, rawNodeType, rawStatus, columnsKey]);

  const typeLabel =
    node.diagramType === 'bpmn'
      ? t.toolPalette[
          (BPMN_TYPE_OPTIONS.find((o) => o.value === rawNodeType)?.translationKey ??
            'task') as keyof typeof t.toolPalette
        ]
      : t.properties.title_node;

  const isAttachmentEligible = attachmentEligibleTypes.includes(rawNodeType);

  function handleCommit<K extends keyof NodeUpdate>(key: K, value: NodeUpdate[K]) {
    onUpdateNode?.(node.id, { [key]: value } as NodeUpdate);
  }

  const isErdTable = node.diagramType === 'erd' && rawNodeType === 'table';

  function commitColumns(next: Column[]) {
    setColumns(next);
    handleCommit('columns', next);
  }

  function updateColumn(index: number, patch: Partial<Column>) {
    const next = columns.map((col, i) => (i === index ? { ...col, ...patch } : col));
    commitColumns(next);
  }

  function removeColumn(index: number) {
    if (columns.length <= 1) return;
    commitColumns(columns.filter((_, i) => i !== index));
  }

  function addColumn() {
    const baseName = 'new_col';
    const existing = new Set(columns.map((c) => c.name));
    let suffix = existing.has(baseName) ? 2 : 0;
    let name = suffix === 0 ? baseName : `${baseName}_${suffix}`;
    while (existing.has(name)) {
      suffix += 1;
      name = `${baseName}_${suffix}`;
    }
    commitColumns([...columns, { name, type: 'text' }]);
  }

  return (
    <aside
      className="w-[300px] shrink-0 border-l bg-background/80 flex flex-col"
      aria-label="Properties Panel"
    >
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b">
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {typeLabel}
          </div>
          <div className="font-semibold text-sm truncate" title={label}>
            {label || node.id}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1 rounded -mr-1"
          aria-label={t.properties.close}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <Field label={t.properties.label}>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => handleCommit('label', label)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="h-8 text-sm"
          />
        </Field>

        {node.diagramType === 'bpmn' && (
          <Field label={t.properties.type}>
            <select
              value={nodeType}
              onChange={(e) => {
                setNodeType(e.target.value);
                handleCommit('type', e.target.value);
              }}
              className="h-8 w-full rounded-md border bg-background px-2 text-sm"
            >
              {BPMN_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t.toolPalette[opt.translationKey as keyof typeof t.toolPalette]}
                </option>
              ))}
            </select>
          </Field>
        )}

        {node.diagramType === 'bpmn' && (
          <Field label={t.properties.status}>
            <div
              role="radiogroup"
              aria-label={t.properties.status}
              className="grid grid-cols-3 gap-1"
            >
              {STATUS_OPTIONS.map((opt) => {
                const selected = status === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      const next = selected ? null : opt;
                      setStatus(next);
                      handleCommit('status', next);
                    }}
                    className={cn(
                      'h-8 rounded-md border px-2 text-xs font-medium transition-colors',
                      selected
                        ? statusButtonActiveClass(opt)
                        : 'bg-background hover:bg-accent text-muted-foreground'
                    )}
                  >
                    {statusLabel(opt)}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {isErdTable && (
          <Field label={t.properties.columns}>
            <div className="space-y-1.5" data-testid="columns-list">
              {columns.map((col, index) => (
                <ColumnRow
                  key={index}
                  column={col}
                  canRemove={columns.length > 1}
                  removeLabel={t.properties.column_remove}
                  removeDisabledLabel={t.properties.column_remove_disabled}
                  namePlaceholder={t.properties.column_name_placeholder}
                  typePlaceholder={t.properties.column_type_placeholder}
                  primaryLabel={t.properties.column_primary}
                  onChange={(patch) => updateColumn(index, patch)}
                  onRemove={() => removeColumn(index)}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addColumn}
                className="h-7 w-full text-xs gap-1"
                data-testid="add-column"
              >
                <Plus className="h-3 w-3" />
                {t.properties.add_column}
              </Button>
            </div>
          </Field>
        )}

        <Field label={t.properties.comment}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => handleCommit('description', description)}
            rows={3}
            placeholder={t.properties.comment_placeholder}
            className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm resize-none"
          />
        </Field>

        {/* MA-1: attachment-slot only renders when the Hub explicitly
            injects one via the `attachmentSlot` prop. The standalone
            Vite-mode editor showed a Screen-Recording-Stub button that
            did nothing — confusing during the user-test. The slot is
            still entirely opt-in for Hub consumers. */}
        {isAttachmentEligible && attachmentSlot && (
          <Field label={t.properties.attachments}>
            {attachmentSlot({
              nodeId: node.id,
              nodeType: rawNodeType,
              diagramType: node.diagramType,
            })}
          </Field>
        )}
      </div>
    </aside>
  );
}

function statusButtonActiveClass(status: PersistentStatus): string {
  switch (status) {
    case 'open':
      return 'bg-sky-500/15 border-sky-500 text-sky-600 ring-1 ring-sky-500/50';
    case 'done':
      return 'bg-emerald-500/15 border-emerald-500 text-emerald-600 ring-1 ring-emerald-500/50';
    case 'blocked':
      return 'bg-red-500/15 border-red-500 text-red-600 ring-1 ring-red-500/50';
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

interface ColumnRowProps {
  column: Column;
  canRemove: boolean;
  removeLabel: string;
  removeDisabledLabel: string;
  namePlaceholder: string;
  typePlaceholder: string;
  primaryLabel: string;
  onChange: (patch: Partial<Column>) => void;
  onRemove: () => void;
}

function ColumnRow({
  column,
  canRemove,
  removeLabel,
  removeDisabledLabel,
  namePlaceholder,
  typePlaceholder,
  primaryLabel,
  onChange,
  onRemove,
}: ColumnRowProps) {
  const [name, setName] = useState(column.name);
  const [type, setType] = useState(column.type);

  // Re-sync local state when the column ref changes from outside (e.g.
  // sibling row removal renumbers this row's index).
  useEffect(() => {
    setName(column.name);
    setType(column.type);
  }, [column.name, column.type]);

  return (
    <div className="flex items-center gap-1" data-testid="column-row">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name !== column.name) onChange({ name });
        }}
        placeholder={namePlaceholder}
        className="h-7 flex-1 min-w-0 text-xs"
        aria-label={namePlaceholder}
      />
      <Input
        value={type}
        onChange={(e) => setType(e.target.value)}
        onBlur={() => {
          if (type !== column.type) onChange({ type });
        }}
        placeholder={typePlaceholder}
        className="h-7 w-20 text-xs"
        aria-label={typePlaceholder}
      />
      <label
        className={cn(
          'flex h-7 shrink-0 items-center gap-1 px-1 text-[10px] font-mono uppercase tracking-wider',
          column.primary ? 'text-foreground' : 'text-muted-foreground'
        )}
        title={primaryLabel}
      >
        <input
          type="checkbox"
          checked={column.primary ?? false}
          onChange={(e) => onChange({ primary: e.target.checked || undefined })}
          className="h-3 w-3"
          aria-label={primaryLabel}
        />
        {primaryLabel}
      </label>
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        title={canRemove ? removeLabel : removeDisabledLabel}
        className="h-7 w-7 shrink-0 rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent flex items-center justify-center"
        aria-label={canRemove ? removeLabel : removeDisabledLabel}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

interface EmptyPropertiesProps {
  meta?: PropertiesPanelProps['diagramMeta'];
}

function EmptyProperties({ meta }: EmptyPropertiesProps) {
  const { t } = useI18n();
  return (
    <aside
      className="w-[300px] shrink-0 border-l bg-background/80 flex flex-col"
      aria-label="Properties Panel (no selection)"
    >
      <div className="px-4 pt-4 pb-3 border-b">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {t.properties.diagram}
        </div>
        <div className="font-semibold text-sm truncate">
          {meta?.name ?? 'Untitled'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {meta?.format && (
          <div className="space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {t.properties.format}
            </div>
            <div className="font-mono text-xs">{meta.format}</div>
          </div>
        )}
        {typeof meta?.itemCount === 'number' && (
          <div className="space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {meta.itemLabel ?? 'Items'}
            </div>
            <div className="font-mono text-xs">{meta.itemCount}</div>
          </div>
        )}
        <div className="rounded-md border-dashed border-2 border-muted p-3 text-xs text-muted-foreground leading-relaxed">
          <p className="mb-1.5 font-medium text-foreground/80">
            {t.properties.empty_hint_head}
          </p>
          <p>{t.properties.empty_hint_body}</p>
        </div>
      </div>
    </aside>
  );
}
