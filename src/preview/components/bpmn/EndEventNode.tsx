import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface EndEventNodeData {
  label: string;
}

export const EndEventNode = memo(function EndEventNode({
  id,
  data,
}: {
  id: string;
  data: EndEventNodeData;
}) {
  return (
    <div
      className="bpmn-node"
      role="listitem"
      aria-label={`BPMN end event ${data.label || id}`}
      tabIndex={0}
    >
      <div className="bpmn-end-event" title={data.label}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="4" y="4" width="8" height="8" fill="#EF4444" rx="1" />
        </svg>
      </div>
      <Handle type="target" position={Position.Left} />
    </div>
  );
});
