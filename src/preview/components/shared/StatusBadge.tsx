import React, { memo } from 'react';
import { Check, AlertTriangle, Clock } from 'lucide-react';
import { useI18n, type PersistentStatus } from '@/i18n/useI18n.js';

interface StatusBadgeProps {
  status: PersistentStatus | undefined;
  /** Optional compact mode (icon-only) for dense node renders. */
  compact?: boolean;
}

/**
 * Single-source-of-truth badge for node status. Icon + accessible label
 * come from the active locale; colour comes from TAFKA semantic palette
 * (matches theme.ts statusClassDefs).
 */
export const StatusBadge = memo(function StatusBadge({ status, compact }: StatusBadgeProps) {
  const { statusLabel } = useI18n();
  if (!status) return null;

  const Icon = status === 'done' ? Check : status === 'blocked' ? AlertTriangle : Clock;
  const colorClass =
    status === 'done'
      ? 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/40'
      : status === 'blocked'
        ? 'bg-red-500/15 text-red-600 ring-red-500/40'
        : 'bg-sky-500/15 text-sky-600 ring-sky-500/40';

  const label = statusLabel(status);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ${colorClass}`}
      role="status"
      aria-label={label}
      title={label}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {!compact && <span>{label}</span>}
    </span>
  );
});
