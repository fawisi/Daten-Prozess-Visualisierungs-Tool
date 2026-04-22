import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { StatusBadge } from '@/components/shared/StatusBadge.js';
import type { Column } from '../../schema.js';
import type { PersistentStatus } from '@/i18n/useI18n.js';

interface TableNodeData {
  label: string;
  columns: Column[];
  description?: string;
  isNew?: boolean;
  status?: PersistentStatus;
}

const TableIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <line x1="1" y1="5" x2="13" y2="5" stroke="currentColor" strokeWidth="1.5" />
    <line x1="5" y1="5" x2="5" y2="13" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const ColumnRow = memo(({ column }: { column: Column }) => (
  <div className="table-node__row" data-pk={column.primary ? 'true' : undefined}>
    <span className="table-node__col-name">{column.name}</span>
    <span className="table-node__col-type">{column.type}</span>
    <span>
      {column.primary && <span className="badge badge--pk">PK</span>}
      {column.nullable && <span className="badge badge--nullable">?</span>}
    </span>
    <Handle type="source" position={Position.Right} id={`${column.name}-source`} style={{ top: 'auto' }} />
    <Handle type="target" position={Position.Left} id={`${column.name}-target`} style={{ top: 'auto' }} />
  </div>
));

ColumnRow.displayName = 'ColumnRow';

function TableNodeComponent({ id, data, selected }: NodeProps & { data: TableNodeData }) {
  const { label, columns, isNew, status } = data;
  const pkCount = columns.filter((c) => c.primary).length;
  const ariaLabel = `ERD table ${label || id} with ${columns.length} column${columns.length === 1 ? '' : 's'}, ${pkCount} primary key${pkCount === 1 ? '' : 's'}${status ? `, status ${status}` : ''}`;

  return (
    <div
      className={`table-node${selected ? ' selected' : ''}${isNew ? ' table-node--entering' : ''}`}
      role="listitem"
      aria-label={ariaLabel}
      tabIndex={0}
      data-status={status ?? undefined}
    >
      <div className="table-node__header">
        <span className="table-node__icon"><TableIcon /></span>
        <span className="table-node__name">{label}</span>
        <span className="table-node__count">{columns.length}</span>
        {status && (
          <span className="table-node__status">
            <StatusBadge status={status} compact />
          </span>
        )}
      </div>
      <div className="table-node__body">
        {columns.map((col) => (
          <ColumnRow key={col.name} column={col} />
        ))}
      </div>
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
TableNode.displayName = 'TableNode';
