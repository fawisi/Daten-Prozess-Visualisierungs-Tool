import React from 'react';
import {
  BaseEdge,
  getSmoothStepPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from '@xyflow/react';

interface SequenceFlowEdgeData {
  label?: string | null;
}

export function SequenceFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
}: EdgeProps & { data?: SequenceFlowEdgeData }) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  return (
    <>
      {/* B4 (2026-05-03): BaseEdge statt nacktem path → bekommt interaction-Path
          fuer klickbare Hitbox. Ohne BaseEdge war Edge-Click bei BPMN unmoeglich. */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        markerEnd="url(#arrow)"
        interactionWidth={40}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            className="edge-label"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
