import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface StartEventNodeData {
  label: string;
}

export const StartEventNode = memo(function StartEventNode({
  data,
}: {
  data: StartEventNodeData;
}) {
  return (
    <div className="bpmn-node">
      <div className="bpmn-start-event" title={data.label}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <polygon points="5,3 13,8 5,13" fill="#22C55E" />
        </svg>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
