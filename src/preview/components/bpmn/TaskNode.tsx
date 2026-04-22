import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { StatusBadge } from '@/components/shared/StatusBadge.js';
import type { PersistentStatus } from '@/i18n/useI18n.js';

interface TaskNodeData {
  label: string;
  description?: string;
  status?: PersistentStatus;
}

export const TaskNode = memo(function TaskNode({
  id,
  data,
}: {
  id: string;
  data: TaskNodeData;
}) {
  const ariaLabel = [
    `BPMN task`,
    data.label || id,
    data.description ? `— ${data.description}` : '',
    data.status ? `status:${data.status}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className="bpmn-node"
      role="listitem"
      aria-label={ariaLabel}
      tabIndex={0}
      data-status={data.status ?? undefined}
    >
      <div className="bpmn-task">
        <div className="bpmn-task__label">{data.label}</div>
        {data.description && (
          <div className="bpmn-task__description">{data.description}</div>
        )}
        {data.status && (
          <div className="bpmn-task__status">
            <StatusBadge status={data.status} compact />
          </div>
        )}
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
