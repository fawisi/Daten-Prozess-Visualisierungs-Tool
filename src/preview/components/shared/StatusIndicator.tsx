import React from 'react';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

interface StatusIndicatorProps {
  status: ConnectionStatus;
}

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  reconnecting: 'Reconnecting...',
  disconnected: 'Disconnected',
};

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const dotClass =
    status === 'reconnecting'
      ? 'status-indicator__dot status-indicator__dot--reconnecting'
      : status === 'disconnected'
        ? 'status-indicator__dot status-indicator__dot--error'
        : 'status-indicator__dot';

  return (
    <div className="status-indicator">
      <div className={dotClass} />
      <span>{STATUS_TEXT[status]}</span>
    </div>
  );
}
