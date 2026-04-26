import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { PersistentStatus } from '@/i18n/useI18n.js';

interface StartEventNodeData {
  label: string;
  status?: PersistentStatus;
}

export const StartEventNode = memo(function StartEventNode({
  id,
  data,
}: {
  id: string;
  data: StartEventNodeData;
}) {
  return (
    <div
      className="bpmn-node"
      role="listitem"
      aria-label={`BPMN start event ${data.label || id}${
        data.status ? ` status:${data.status}` : ''
      }`}
      tabIndex={0}
      data-status={data.status ?? undefined}
    >
      <div className="bpmn-start-event" title={data.label}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <polygon points="5,3 13,8 5,13" fill="#22C55E" />
        </svg>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
