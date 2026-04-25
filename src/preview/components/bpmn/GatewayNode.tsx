import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { PersistentStatus } from '@/i18n/useI18n.js';

interface GatewayNodeData {
  label: string;
  status?: PersistentStatus;
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
      aria-label={`BPMN exclusive gateway ${data.label || id}${
        data.status ? ` status:${data.status}` : ''
      }`}
      tabIndex={0}
      data-status={data.status ?? undefined}
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
