import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useIncidents } from '@/hooks/useIncidents';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { SummaryCards } from '@/components/SummaryCards';
import { CriticalAlertBanner } from '@/components/CriticalAlertBanner';
import { IncidentCard } from '@/components/IncidentCard';
import { ReportButton } from '@/components/Navigation';
import { EmptyState } from '@/components/FilterBar';
import { PRIORITY_META } from '@/lib/constants';

export function DashboardPage({ onReport }: { onReport: () => void }) {
  const { incidents, loading } = useIncidents();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState<string[]>([]);

  const isAdmin = profile?.role === 'admin';
  const visibleIncidents = useMemo(
    () => (isAdmin ? incidents : incidents.filter((i) => i.reporter_id === profile?.id)),
    [incidents, isAdmin, profile],
  );

  const unackedCritical = useMemo(
    () =>
      visibleIncidents.filter(
        (i) =>
          i.priority === 'critical' &&
          !i.acknowledged &&
          i.status !== 'resolved' &&
          !dismissed.includes(i.id),
      ),
    [visibleIncidents, dismissed],
  );

  const recentActive = useMemo(
    () =>
      [...visibleIncidents]
        .filter((i) => i.status !== 'resolved')
        .sort((a, b) => {
          const pr = PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank;
          if (pr !== 0) return pr;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })
        .slice(0, 8),
    [visibleIncidents],
  );

  // Audit history is now recorded automatically by database triggers.
  const handleAcknowledge = async (id: string) => {
    if (!profile) return;
    const { error } = await supabase
      .from('incidents')
      .update({
        acknowledged: true,
        acknowledged_by: profile.id,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) {
      toast('Failed to acknowledge', 'error');
      return;
    }
    setDismissed((d) => [...d, id]);
    toast('Incident acknowledged', 'success');
  };

  const handleDismiss = (id: string) => {
    setDismissed((d) => [...d, id]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900 tracking-tight">Command Center</h1>
          <p className="text-sm text-ink-500 mt-0.5">Real-time overview of conference incidents</p>
        </div>
        <ReportButton onClick={onReport} />
      </div>

      {unackedCritical.length > 0 && (
        <CriticalAlertBanner
          incidents={unackedCritical}
          onAcknowledge={handleAcknowledge}
          onDismiss={handleDismiss}
        />
      )}

      <SummaryCards incidents={visibleIncidents} />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-ink-900">Active Incidents</h2>
          <Link to="/incidents" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
            View all
          </Link>
        </div>

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
        ) : recentActive.length === 0 ? (
          <EmptyState
            icon={<ShieldAlert className="w-7 h-7" />}
            title="All clear"
            message="There are currently no active incidents. Great work, team."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {recentActive.map((inc) => (
              <IncidentCard key={inc.id} incident={inc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
