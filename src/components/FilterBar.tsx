import { useState, type ReactNode } from 'react';
import { Search, SlidersHorizontal, X, ArrowUpDown } from 'lucide-react';
import { STATUSES, PRIORITIES, INCIDENT_TYPES, LOCATIONS, TYPE_META } from '@/lib/constants';
import type { IncidentStatus, IncidentPriority, IncidentType } from '@/lib/types';
import type { Profile } from '@/lib/types';

export type SortKey = 'newest' | 'oldest' | 'priority' | 'updated';

export interface FilterState {
  search: string;
  status: IncidentStatus | 'all';
  priority: IncidentPriority | 'all';
  type: IncidentType | 'all';
  location: string | 'all';
  reporter: string | 'all';
  assignedTo: string | 'all';
  sort: SortKey;
}

export const defaultFilters: FilterState = {
  search: '',
  status: 'all',
  priority: 'all',
  type: 'all',
  location: 'all',
  reporter: 'all',
  assignedTo: 'all',
  sort: 'newest',
};

export function FilterBar({
  filters,
  setFilters,
  users,
  showStatus = true,
}: {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  users: Profile[];
  showStatus?: boolean;
}) {
  const [advanced, setAdvanced] = useState(false);
  const update = (patch: Partial<FilterState>) => setFilters({ ...filters, ...patch });
  const activeCount =
    (filters.status !== 'all' ? 1 : 0) +
    (filters.priority !== 'all' ? 1 : 0) +
    (filters.type !== 'all' ? 1 : 0) +
    (filters.location !== 'all' ? 1 : 0) +
    (filters.reporter !== 'all' ? 1 : 0) +
    (filters.assignedTo !== 'all' ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Search + sort row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-ink-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            placeholder="Search incidents..."
            className="input pl-10"
            aria-label="Search incidents"
          />
          {filters.search && (
            <button
              onClick={() => update({ search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="relative">
          <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
          <select
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value as SortKey })}
            className="input pl-9 pr-8 appearance-none cursor-pointer"
            aria-label="Sort"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="priority">Highest priority</option>
            <option value="updated">Recently updated</option>
          </select>
        </div>
        <button
          onClick={() => setAdvanced(!advanced)}
          className={`btn-secondary relative ${advanced ? 'bg-brand-50 border-brand-300 text-brand-700' : ''}`}
          aria-label="Toggle filters"
        >
          <SlidersHorizontal className="w-4.5 h-4.5" />
          <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-brand-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Advanced filters */}
      {advanced && (
        <div className="card p-4 animate-fade-in space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {showStatus && (
              <FilterSelect
                label="Status"
                value={filters.status}
                onChange={(v) => update({ status: v as IncidentStatus | 'all' })}
                options={[{ value: 'all', label: 'All status' }, ...STATUSES.map((s) => ({ value: s, label: s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1) }))]}
              />
            )}
            <FilterSelect
              label="Priority"
              value={filters.priority}
              onChange={(v) => update({ priority: v as IncidentPriority | 'all' })}
              options={[{ value: 'all', label: 'All priority' }, ...PRIORITIES.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))]}
            />
            <FilterSelect
              label="Type"
              value={filters.type}
              onChange={(v) => update({ type: v as IncidentType | 'all' })}
              options={[{ value: 'all', label: 'All types' }, ...INCIDENT_TYPES.map((t) => ({ value: t, label: TYPE_META[t].label }))]}
            />
            <FilterSelect
              label="Location"
              value={filters.location}
              onChange={(v) => update({ location: v })}
              options={[{ value: 'all', label: 'All locations' }, ...LOCATIONS.map((l) => ({ value: l, label: l }))]}
            />
            <FilterSelect
              label="Reporter"
              value={filters.reporter}
              onChange={(v) => update({ reporter: v })}
              options={[{ value: 'all', label: 'All reporters' }, ...users.map((u) => ({ value: u.id, label: u.name }))]}
            />
            <FilterSelect
              label="Assigned"
              value={filters.assignedTo}
              onChange={(v) => update({ assignedTo: v })}
              options={[{ value: 'all', label: 'Anyone' }, { value: 'unassigned', label: 'Unassigned' }, ...users.map((u) => ({ value: u.id, label: u.name }))]}
            />
          </div>
          {activeCount > 0 && (
            <button
              onClick={() =>
                setFilters({
                  ...filters,
                  status: 'all',
                  priority: 'all',
                  type: 'all',
                  location: 'all',
                  reporter: 'all',
                  assignedTo: 'all',
                })
              }
              className="text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="label text-xs">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input py-2 text-sm">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function EmptyState({ icon, title, message, action }: { icon: ReactNode; title: string; message: string; action?: ReactNode }) {
  return (
    <div className="card p-10 text-center">
      <div className="w-14 h-14 rounded-full bg-ink-100 flex items-center justify-center mx-auto mb-4 text-ink-400">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-ink-900 mb-1">{title}</h3>
      <p className="text-sm text-ink-500 max-w-sm mx-auto">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
