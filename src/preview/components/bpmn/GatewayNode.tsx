import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface GatewayNodeData {
  label: string;
}

export const GatewayNode = memo(function GatewayNode({
  id,
  data,
}: {
  id: string;
  data: GatewayNodeData;
}) {
  return (
    <div
      className="bpmn-node"
      title={data.label}
      role="listitem"
      aria-label={`BPMN exclusive gateway ${data.label || id}`}
      tabIndex={0}
    >
      <div className="bpmn-gateway">
        <span className="bpmn-gateway__icon" aria-hidden="true">X</span>
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
    </div>
  );
});
