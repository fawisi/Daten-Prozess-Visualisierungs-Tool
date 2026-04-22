import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface TaskNodeData {
  label: string;
  description?: string;
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
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="bpmn-node" role="listitem" aria-label={ariaLabel} tabIndex={0}>
      <div className="bpmn-task">
        <div className="bpmn-task__label">{data.label}</div>
        {data.description && (
          <div className="bpmn-task__description">{data.description}</div>
        )}
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
