import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import type { Incident } from '@/lib/types';
import { TYPE_META } from '@/lib/constants';
import { formatTime } from '@/lib/format';

export function CriticalAlertBanner({
  incidents,
  onAcknowledge,
  onDismiss,
}: {
  incidents: Incident[];
  onAcknowledge: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  if (incidents.length === 0) return null;

  return (
    <div className="space-y-2">
      {incidents.map((inc) => (
        <div
          key={inc.id}
          className="card border-critical-300 bg-critical-50 p-4 animate-fade-in"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-critical-100 flex items-center justify-center shrink-0 animate-pulse-ring">
              <AlertTriangle className="w-5 h-5 text-critical-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="badge bg-critical-600 text-white border border-critical-700">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  NEW CRITICAL INCIDENT
                </span>
                <span className="text-xs text-ink-500 font-medium">
                  {formatTime(inc.created_at)}
                </span>
              </div>
              <p className="font-bold text-ink-900 text-sm sm:text-base leading-snug">
                {TYPE_META[inc.type].icon} {inc.title}
              </p>
              <p className="text-sm text-ink-600 mt-0.5">
                {inc.location} · Reported by {inc.reporter?.name ?? 'Unknown'}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Link
                  to={`/incidents/${inc.id}`}
                  className="btn-primary text-xs px-3 py-2 bg-critical-600 hover:bg-critical-700"
                >
                  View Incident <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  onClick={() => onAcknowledge(inc.id)}
                  className="btn-secondary text-xs px-3 py-2"
                >
                  Acknowledge
                </button>
              </div>
            </div>
            <button
              onClick={() => onDismiss(inc.id)}
              className="text-critical-400 hover:text-critical-700 hover:bg-critical-100 rounded-lg p-1.5 transition-colors shrink-0"
              aria-label="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
