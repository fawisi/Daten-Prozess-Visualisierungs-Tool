import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface EndEventNodeData {
  label: string;
}

export const EndEventNode = memo(function EndEventNode({
  data,
}: {
  data: EndEventNodeData;
}) {
  return (
    <div className="bpmn-node">
      <div className="bpmn-end-event" title={data.label}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="4" y="4" width="8" height="8" fill="#EF4444" rx="1" />
        </svg>
      </div>
      <Handle type="target" position={Position.Left} />
    </div>
  );
});
