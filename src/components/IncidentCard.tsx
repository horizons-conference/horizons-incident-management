import { Link } from 'react-router-dom';
import { MapPin, Clock, User, Hand } from 'lucide-react';
import type { Incident } from '@/lib/types';
import { PriorityBadge, StatusBadge, TypeBadge } from './Badges';
import { PRIORITY_META } from '@/lib/constants';
import { formatTime, formatRelative, formatDateTimeLocal } from '@/lib/format';

export function IncidentCard({ incident }: { incident: Incident }) {
  const pm = PRIORITY_META[incident.priority];
  const isCriticalUnack = incident.priority === 'critical' && !incident.acknowledged;

  return (
    <Link
      to={`/incidents/${incident.id}`}
      className={`card block p-4 hover:shadow-card-hover hover:border-ink-300 transition-all duration-150 group relative overflow-hidden ${
        isCriticalUnack ? 'ring-2 ring-critical-400/60' : ''
      }`}
    >
      {/* Priority left border */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1.5 ${pm.dot} ${
          isCriticalUnack ? 'animate-pulse' : ''
        }`}
      />

      <div className="pl-2">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <PriorityBadge priority={incident.priority} />
            <StatusBadge status={incident.status} />
          </div>
          <span className="text-xs text-ink-400 font-medium shrink-0">
            {incident.incident_number}
          </span>
        </div>

        <div className="mb-1.5">
          <TypeBadge type={incident.type} />
        </div>

        <h3 className="font-semibold text-ink-900 leading-snug mb-2 group-hover:text-brand-700 transition-colors">
          {incident.title}
        </h3>

        <div className="flex items-center gap-3 text-xs text-ink-500 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {incident.location}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatTime(incident.created_at)}
          </span>
          <span className="inline-flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            {incident.reporter?.name ?? 'Unknown'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-ink-100">
          <p className="text-xs text-ink-500 truncate flex-1">
            {incident.claimed_by ? (
              <span className="inline-flex items-center gap-1 text-brand-700 font-semibold">
                <Hand className="w-3 h-3" />
                Managed by {incident.claimer?.name ?? 'Secretariat'}
                {incident.claimed_at && (
                  <span className="font-normal text-ink-400 ml-1">· {formatDateTimeLocal(incident.claimed_at)}</span>
                )}
              </span>
            ) : incident.assigned_to ? (
              <>
                Assigned to{' '}
                <span className="font-semibold text-ink-700">
                  {incident.assignee?.name ?? 'Someone'}
                </span>
              </>
            ) : (
              <span className="text-ink-400">Unassigned</span>
            )}
          </p>
          <span className="text-xs text-ink-400">{formatRelative(incident.created_at)}</span>
        </div>

        {isCriticalUnack && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-critical-700 bg-critical-50 border border-critical-200 rounded-full px-2.5 py-1">
            <span className="w-2 h-2 rounded-full bg-critical-500 animate-pulse" />
            NOT ACKNOWLEDGED
          </div>
        )}
      </div>
    </Link>
  );
}
