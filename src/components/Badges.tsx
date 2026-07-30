import { PRIORITY_META, STATUS_META, TYPE_META } from '@/lib/constants';
import type { IncidentPriority, IncidentStatus, IncidentType } from '@/lib/types';

export function PriorityBadge({
  priority,
  size = 'sm',
}: {
  priority: IncidentPriority;
  size?: 'sm' | 'md';
}) {
  const m = PRIORITY_META[priority];
  return (
    <span
      className={`badge ${m.bg} ${m.text} border ${m.border} ${
        size === 'md' ? 'px-3 py-1.5 text-sm' : ''
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function StatusBadge({
  status,
  size = 'sm',
}: {
  status: IncidentStatus;
  size?: 'sm' | 'md';
}) {
  const m = STATUS_META[status];
  return (
    <span
      className={`badge ${m.bg} ${m.text} border ${m.border} ${
        size === 'md' ? 'px-3 py-1.5 text-sm' : ''
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function TypeBadge({ type }: { type: IncidentType }) {
  const m = TYPE_META[type];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-700">
      <span aria-hidden>{m.icon}</span>
      {m.label}
    </span>
  );
}
