import { useMemo, useState } from 'react';
import { ListChecks, ShieldAlert, Search } from 'lucide-react';
import { useIncidents, useUsers } from '@/hooks/useIncidents';
import { useAuth } from '@/context/AuthContext';
import { IncidentCard } from '@/components/IncidentCard';
import { FilterBar, EmptyState, defaultFilters, type FilterState } from '@/components/FilterBar';
import { ReportButton } from '@/components/Navigation';
import { PRIORITY_META, TYPE_META, STATUS_META } from '@/lib/constants';
import type { Incident } from '@/lib/types';

type View = 'all' | 'active' | 'critical' | 'mine' | 'resolved';

const VIEW_TABS: { key: View; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'critical', label: 'Critical' },
  { key: 'mine', label: 'My Incidents' },
  { key: 'resolved', label: 'Resolved' },
];

export function IncidentsPage({
  initialView = 'all',
  onReport,
}: {
  initialView?: View;
  onReport: () => void;
}) {
  const { incidents, loading } = useIncidents();
  const { users } = useUsers();
  const { profile } = useAuth();
  const [view, setView] = useState<View>(initialView);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const filtered = useMemo(() => {
    let list = [...incidents];

    // View filter
    if (view === 'active') list = list.filter((i) => i.status !== 'resolved');
    if (view === 'critical') list = list.filter((i) => i.priority === 'critical');
    if (view === 'mine') list = list.filter((i) => i.assigned_to === profile?.id);
    if (view === 'resolved') list = list.filter((i) => i.status === 'resolved');

    // Search
    const q = filters.search.trim().toLowerCase();
    if (q) {
      list = list.filter((i) => {
        const reporter = i.reporter?.name ?? '';
        const assignee = i.assignee?.name ?? '';
        const notesText = (i.incident_notes ?? []).map((n) => n.note).join(' ');
        return (
          i.incident_number?.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.location.toLowerCase().includes(q) ||
          reporter.toLowerCase().includes(q) ||
          assignee.toLowerCase().includes(q) ||
          notesText.toLowerCase().includes(q)
        );
      });
    }

    // Filters
    if (filters.status !== 'all') list = list.filter((i) => i.status === filters.status);
    if (filters.priority !== 'all') list = list.filter((i) => i.priority === filters.priority);
    if (filters.type !== 'all') list = list.filter((i) => i.type === filters.type);
    if (filters.location !== 'all') list = list.filter((i) => i.location === filters.location);
    if (filters.reporter !== 'all')
      list = list.filter((i) => i.reporter_id === filters.reporter);
    if (filters.assignedTo !== 'all') {
      if (filters.assignedTo === 'unassigned') {
        list = list.filter((i) => !i.assigned_to);
      } else {
        list = list.filter((i) => i.assigned_to === filters.assignedTo);
      }
    }

    // Sort
    switch (filters.sort) {
      case 'newest':
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'priority':
        list.sort(
          (a, b) =>
            PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        break;
      case 'updated':
        list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        break;
    }

    return list;
  }, [incidents, view, filters, profile]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900 tracking-tight">Incidents</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {filtered.length} {filtered.length === 1 ? 'incident' : 'incidents'}
          </p>
        </div>
        <ReportButton onClick={onReport} />
      </div>

      {/* View tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
              view === tab.key
                ? 'bg-ink-900 text-white'
                : 'bg-white text-ink-600 border border-ink-200 hover:bg-ink-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <FilterBar filters={filters} setFilters={setFilters} users={users} />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-ink-100 rounded w-1/3 mb-3" />
              <div className="h-5 bg-ink-100 rounded w-2/3 mb-2" />
              <div className="h-3 bg-ink-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="w-7 h-7" />}
          title="No incidents found"
          message="Try changing your filters or search terms."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((inc) => (
            <IncidentCard key={inc.id} incident={inc} />
          ))}
        </div>
      )}
    </div>
  );
}
