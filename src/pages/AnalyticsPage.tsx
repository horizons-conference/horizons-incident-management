import { useMemo } from 'react';
import { useIncidents } from '@/hooks/useIncidents';
import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';
import { BarChart3, Download, Clock, TrendingUp, MapPin, AlertOctagon } from 'lucide-react';
import { INCIDENT_TYPES, PRIORITIES, TYPE_META, PRIORITY_META } from '@/lib/constants';
import { isToday, formatDuration, resolutionTimeMinutes, toCsv } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import type { Incident } from '@/lib/types';

export function AnalyticsPage() {
  const { incidents, loading } = useIncidents();
  const { profile } = useAuth();
  const { toast } = useToast();

  if (profile && profile.role !== 'admin') return <Navigate to="/" replace />;

  const stats = useMemo(() => computeAnalytics(incidents), [incidents]);

  const exportCsv = () => {
    const rows: (string | number | null)[][] = [
      [
        'Incident ID',
        'Date',
        'Time',
        'Type',
        'Priority',
        'Title',
        'Description',
        'Location',
        'Reporter',
        'Assigned To',
        'Status',
        'Resolution Time',
        'Notes',
        'Created At',
        'Updated At',
      ],
      ...incidents.map((i) => [
        i.incident_number ?? '',
        new Date(i.created_at).toLocaleDateString(),
        new Date(i.created_at).toLocaleTimeString(),
        TYPE_META[i.type].label,
        PRIORITY_META[i.priority].label,
        i.title,
        i.description,
        i.location,
        i.reporter?.name ?? '',
        i.assignee?.name ?? '',
        i.status,
        i.resolved_at ? formatDuration(resolutionTimeMinutes(i.created_at, i.resolved_at)) : '',
        (i.incident_notes ?? []).map((n) => n.note).join(' | '),
        i.created_at,
        i.updated_at,
      ]),
    ];
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `horizons2026-incidents-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Incidents exported as CSV', 'success');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-ink-400">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900 tracking-tight">Analytics</h1>
          <p className="text-sm text-ink-500 mt-0.5">Conference incident statistics</p>
        </div>
        <button className="btn-secondary" onClick={exportCsv}>
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatBox icon={<AlertOctagon className="w-5 h-5" />} label="Incidents Today" value={stats.todayTotal} tone="brand" />
        <StatBox icon={<Clock className="w-5 h-5" />} label="Open Now" value={stats.open} tone="critical" />
        <StatBox icon={<TrendingUp className="w-5 h-5" />} label="Resolved" value={stats.resolved} tone="low" />
        <StatBox icon={<Clock className="w-5 h-5" />} label="Avg Resolution" value={stats.avgResolution} tone="high" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* By priority */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-ink-500 uppercase tracking-wide mb-4">By Priority</h2>
          <div className="space-y-3">
            {PRIORITIES.map((p) => {
              const count = stats.byPriority[p];
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              const m = PRIORITY_META[p];
              return (
                <div key={p}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-ink-700 flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${m.dot}`} />
                      {m.label}
                    </span>
                    <span className="text-sm font-bold text-ink-900 tabular-nums">{count}</span>
                  </div>
                  <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                    <div className={`h-full ${m.dot} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By type */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-ink-500 uppercase tracking-wide mb-4">By Type</h2>
          <div className="space-y-3">
            {INCIDENT_TYPES.map((t) => {
              const count = stats.byType[t];
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={t}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-ink-700">
                      {TYPE_META[t].icon} {TYPE_META[t].label}
                    </span>
                    <span className="text-sm font-bold text-ink-900 tabular-nums">{count}</span>
                  </div>
                  <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By location */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-ink-500 uppercase tracking-wide mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            By Location
          </h2>
          <div className="space-y-3">
            {stats.byLocation.length === 0 ? (
              <p className="text-sm text-ink-400">No incidents recorded.</p>
            ) : (
              stats.byLocation.slice(0, 8).map(([loc, count]) => {
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={loc}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-ink-700">{loc}</span>
                      <span className="text-sm font-bold text-ink-900 tabular-nums">{count}</span>
                    </div>
                    <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                      <div className="h-full bg-ink-700 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Incidents over time */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-ink-500 uppercase tracking-wide mb-4">
            Incidents Over Time
          </h2>
          <TimeChart data={stats.overTime} />
        </div>
      </div>
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
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
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tones[tone]}`}>
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

function TimeChart({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
          <div className="w-full flex-1 flex items-end">
            <div
              className="w-full bg-brand-500 rounded-t hover:bg-brand-600 transition-colors relative group"
              style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? '4px' : '0' }}
            >
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-bold text-ink-700 opacity-0 group-hover:opacity-100 transition-opacity">
                {d.count}
              </span>
            </div>
          </div>
          <span className="text-[10px] text-ink-400 font-medium">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function computeAnalytics(incidents: Incident[]) {
  const total = incidents.length;
  const todayTotal = incidents.filter((i) => isToday(i.created_at)).length;
  const open = incidents.filter((i) => i.status !== 'resolved').length;
  const resolved = incidents.filter((i) => i.status === 'resolved').length;

  const byPriority = PRIORITIES.reduce(
    (acc, p) => {
      acc[p] = incidents.filter((i) => i.priority === p).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  const byType = INCIDENT_TYPES.reduce(
    (acc, t) => {
      acc[t] = incidents.filter((i) => i.type === t).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  const locMap = new Map<string, number>();
  incidents.forEach((i) => locMap.set(i.location, (locMap.get(i.location) ?? 0) + 1));
  const byLocation = [...locMap.entries()].sort((a, b) => b[1] - a[1]);

  const resolvedIncidents = incidents.filter((i) => i.resolved_at);
  const avgResolution =
    resolvedIncidents.length > 0
      ? formatDuration(
          resolvedIncidents.reduce(
            (sum, i) => sum + resolutionTimeMinutes(i.created_at, i.resolved_at!),
            0,
          ) / resolvedIncidents.length,
        )
      : '—';

  // Over time — by hour for today, or by day
  const hourMap = new Map<string, number>();
  const now = new Date();
  for (let h = 0; h < 24; h++) {
    const d = new Date(now);
    d.setHours(h, 0, 0, 0);
    const key = `${h}:00`;
    hourMap.set(key, 0);
  }
  incidents.forEach((i) => {
    const d = new Date(i.created_at);
    const key = `${d.getHours()}:00`;
    hourMap.set(key, (hourMap.get(key) ?? 0) + 1);
  });

  // Show last 12 hours with data
  const allHours = [...hourMap.entries()].map(([label, count]) => {
    const h = parseInt(label);
    const d = new Date(now);
    d.setHours(h, 0, 0, 0);
    return { label: h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`, count, hour: h };
  });
  const currentHour = now.getHours();
  const startHour = Math.max(0, currentHour - 11);
  const overTime = allHours.filter((d) => d.hour >= startHour && d.hour <= currentHour);

  return { total, todayTotal, open, resolved, byPriority, byType, byLocation, avgResolution, overTime };
}
