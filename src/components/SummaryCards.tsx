import type { Incident } from '@/lib/types';
import { PRIORITY_META, STATUS_META } from '@/lib/constants';
import { isToday } from '@/lib/format';
import { AlertOctagon, Clock, CheckCircle2, Activity, Inbox } from 'lucide-react';

interface Stats {
  critical: number;
  high: number;
  medium: number;
  low: number;
  open: number;
  inProgress: number;
  resolvedToday: number;
  totalToday: number;
}

export function computeStats(incidents: Incident[]): Stats {
  const open = incidents.filter((i) => i.status === 'open').length;
  const inProgress = incidents.filter((i) => i.status === 'in_progress').length;
  const resolvedToday = incidents.filter(
    (i) => i.status === 'resolved' && i.resolved_at && isToday(i.resolved_at),
  ).length;
  const totalToday = incidents.filter((i) => isToday(i.created_at)).length;

  const byPriority = (p: string) =>
    incidents.filter((i) => i.priority === p && i.status !== 'resolved').length;

  return {
    critical: byPriority('critical'),
    high: byPriority('high'),
    medium: byPriority('medium'),
    low: byPriority('low'),
    open,
    inProgress,
    resolvedToday,
    totalToday,
  };
}

export function SummaryCards({ incidents }: { incidents: Incident[] }) {
  const s = computeStats(incidents);

  return (
    <div className="space-y-3">
      {/* Priority cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PriorityCard
          label="Critical"
          count={s.critical}
          dotClass="bg-critical-500"
          textClass="text-critical-700"
          bgClass="bg-critical-50"
          borderClass="border-critical-200"
          pulse={s.critical > 0}
        />
        <PriorityCard
          label="High"
          count={s.high}
          dotClass="bg-high-500"
          textClass="text-high-700"
          bgClass="bg-high-50"
          borderClass="border-high-200"
        />
        <PriorityCard
          label="Medium"
          count={s.medium}
          dotClass="bg-medium-500"
          textClass="text-medium-700"
          bgClass="bg-medium-50"
          borderClass="border-medium-200"
        />
        <PriorityCard
          label="Low"
          count={s.low}
          dotClass="bg-low-500"
          textClass="text-low-700"
          bgClass="bg-low-50"
          borderClass="border-low-200"
        />
      </div>

      {/* Operational stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Inbox className="w-4.5 h-4.5" />}
          label="Open"
          value={s.open}
          tone="critical"
        />
        <StatCard
          icon={<Activity className="w-4.5 h-4.5" />}
          label="In Progress"
          value={s.inProgress}
          tone="high"
        />
        <StatCard
          icon={<CheckCircle2 className="w-4.5 h-4.5" />}
          label="Resolved Today"
          value={s.resolvedToday}
          tone="low"
        />
        <StatCard
          icon={<Clock className="w-4.5 h-4.5" />}
          label="Total Today"
          value={s.totalToday}
          tone="brand"
        />
      </div>
    </div>
  );
}

function PriorityCard({
  label,
  count,
  dotClass,
  textClass,
  bgClass,
  borderClass,
  pulse,
}: {
  label: string;
  count: number;
  dotClass: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  pulse?: boolean;
}) {
  return (
    <div className={`card p-4 border-2 ${borderClass} ${bgClass} relative overflow-hidden`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2.5 h-2.5 rounded-full ${dotClass} ${pulse ? 'animate-pulse' : ''}`} />
        <span className={`text-xs font-bold uppercase tracking-wide ${textClass}`}>{label}</span>
      </div>
      <p className="text-3xl font-extrabold text-ink-900 tabular-nums">{count}</p>
      <p className="text-xs text-ink-500 mt-0.5">open now</p>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'critical' | 'high' | 'low' | 'brand';
}) {
  const tones = {
    critical: 'text-critical-600 bg-critical-50',
    high: 'text-high-600 bg-high-50',
    low: 'text-low-600 bg-low-50',
    brand: 'text-brand-600 bg-brand-50',
  };
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-extrabold text-ink-900 tabular-nums leading-none">{value}</p>
          <p className="text-xs text-ink-500 mt-1">{label}</p>
        </div>
      </div>
    </div>
  );
}

export { AlertOctagon };
