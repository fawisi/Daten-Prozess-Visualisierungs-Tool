import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  User,
  Server,
  Database,
  Cloud,
  Plug,
  Box,
  Frame,
} from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge.js';
import type { PersistentStatus } from '@/i18n/useI18n.js';
import type { LandscapeNodeKind } from '../../../landscape/schema.js';

/**
 * Landscape nodes rendered through a single parameterised component so
 * all 7 C4 kinds (person / system / external / container / database /
 * cloud / boundary) share padding, handle positions, status badge, and
 * memoization. Plan R1: memo + module-scope nodeTypes + NodeProps typing.
 *
 * Icon + palette are picked per kind. Status overlay reuses the shared
 * StatusBadge component, keeping visual parity with ERD + BPMN.
 */

export interface LandscapeNodeData {
  label: string;
  description?: string;
  kind: LandscapeNodeKind;
  technology?: string;
  status?: PersistentStatus;
}

const KIND_ICONS: Record<LandscapeNodeKind, React.ComponentType<{ className?: string }>> = {
  person: User,
  system: Server,
  external: Plug,
  container: Box,
  database: Database,
  cloud: Cloud,
  boundary: Frame,
};

const KIND_CLASSES: Record<LandscapeNodeKind, string> = {
  person: 'landscape-node landscape-node--person',
  system: 'landscape-node landscape-node--system',
  external: 'landscape-node landscape-node--external',
  container: 'landscape-node landscape-node--container',
  database: 'landscape-node landscape-node--database',
  cloud: 'landscape-node landscape-node--cloud',
  boundary: 'landscape-node landscape-node--boundary',
};

function LandscapeNodeComponent({
  id,
  data,
  selected,
}: NodeProps & { data: LandscapeNodeData }) {
  const Icon = KIND_ICONS[data.kind];
  const ariaLabel = [
    `C4 ${data.kind}`,
    data.label || id,
    data.technology ? `(${data.technology})` : '',
    data.status ? `status:${data.status}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={`${KIND_CLASSES[data.kind]}${selected ? ' selected' : ''}`}
      role="listitem"
      aria-label={ariaLabel}
      tabIndex={0}
      data-status={data.status ?? undefined}
      data-kind={data.kind}
    >
      <div className="landscape-node__header">
        <Icon className="landscape-node__icon" aria-hidden="true" />
        <span className="landscape-node__label">{data.label || id}</span>
        {data.status && (
          <span className="landscape-node__status">
            <StatusBadge status={data.status} compact />
          </span>
        )}
      </div>
      {data.technology && (
        <div className="landscape-node__technology">[{data.technology}]</div>
      )}
      {data.description && (
        <div className="landscape-node__description">{data.description}</div>
      )}
      {/* Boundary nodes are pure containers; they don't participate in
          edges themselves — children do. Omit the handles to stop
          React-Flow drawing spurious connectors. */}
      {data.kind !== 'boundary' && (
        <>
          <Handle type="target" position={Position.Left} />
          <Handle type="source" position={Position.Right} />
        </>
      )}
    </div>
  );
}

export const LandscapeNode = memo(LandscapeNodeComponent);
LandscapeNode.displayName = 'LandscapeNode';
