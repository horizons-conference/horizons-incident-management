import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Modal } from './Modal';
import { PRIORITIES, LOCATIONS, PRIORITY_META } from '@/lib/constants';
import { useCategories } from '@/hooks/useIncidents';
import type { IncidentType, IncidentPriority } from '@/lib/types';

export function ReportIncidentModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (incidentId: string, incidentNumber: string) => void;
}) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { categories } = useCategories();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    type: '' as IncidentType | '',
    priority: '' as IncidentPriority | '',
    title: '',
    location: '',
    customLocation: '',
    description: '',
    initialNotes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });

  const activeCategories = categories.filter((c) => c.active);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.type) e.type = 'Select an incident type';
    if (!form.priority) e.priority = 'Select a priority';
    if (!form.title.trim()) e.title = 'Enter a short title';
    if (!form.location) e.location = 'Select a location';
    if (form.location === 'Other' && !form.customLocation.trim())
      e.customLocation = 'Enter the custom location';
    if (!form.description.trim()) e.description = 'Describe what happened';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const reset = () => {
    setForm({
      type: '',
      priority: '',
      title: '',
      location: '',
      customLocation: '',
      description: '',
      initialNotes: '',
    });
    setErrors({});
  };

  const handleSubmit = async () => {
    if (!validate() || !profile) return;
    setSubmitting(true);

    const location =
      form.location === 'Other' ? form.customLocation.trim() : form.location;

    const { data, error } = await supabase
      .from('incidents')
      .insert({
        type: form.type,
        priority: form.priority,
        title: form.title.trim(),
        location,
        description: form.description.trim(),
        reporter_id: profile.id,
        status: 'open',
      })
      .select('id, incident_number')
      .single();

    if (error || !data) {
      toast('Failed to report incident', 'error');
      setSubmitting(false);
      return;
    }

    // Add initial note if provided (audit trigger logs it automatically)
    if (form.initialNotes.trim()) {
      await supabase.from('incident_notes').insert({
        incident_id: data.id,
        author_id: profile.id,
        note: form.initialNotes.trim(),
      });
    }

    // Audit history is now recorded by the trg_incident_audit trigger.
    toast(`Incident ${data.incident_number} reported successfully`, 'success');
    setSubmitting(false);
    reset();
    onCreated(data.id, data.incident_number!);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Report New Incident"
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Incident'
            )}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Type */}
        <div>
          <label className="label">Incident Type</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {activeCategories.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => update({ type: cat.key as IncidentType })}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all ${
                  form.type === cat.key
                    ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20'
                    : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50'
                }`}
              >
                <span className="text-xl" aria-hidden>
                  {cat.icon}
                </span>
                <span className="text-xs font-semibold text-ink-700">{cat.label}</span>
              </button>
            ))}
          </div>
          {errors.type && <p className="text-xs text-critical-600 mt-1.5">{errors.type}</p>}
        </div>

        {/* Priority */}
        <div>
          <label className="label">Priority</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRIORITIES.map((p) => {
              const m = PRIORITY_META[p];
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => update({ priority: p })}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-semibold transition-all ${
                    form.priority === p
                      ? `${m.border} ${m.bg} ring-2 ${m.ring}/20`
                      : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${m.dot}`} />
                  {m.label}
                </button>
              );
            })}
          </div>
          {errors.priority && <p className="text-xs text-critical-600 mt-1.5">{errors.priority}</p>}
        </div>

        {/* Title */}
        <div>
          <label className="label" htmlFor="r-title">
            Title
          </label>
          <input
            id="r-title"
            type="text"
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="e.g. Projector not displaying"
            className="input"
          />
          {errors.title && <p className="text-xs text-critical-600 mt-1.5">{errors.title}</p>}
        </div>

        {/* Location */}
        <div>
          <label className="label" htmlFor="r-location">
            Location
          </label>
          <select
            id="r-location"
            value={form.location}
            onChange={(e) => update({ location: e.target.value })}
            className="input"
          >
            <option value="">Select a location...</option>
            {LOCATIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          {errors.location && <p className="text-xs text-critical-600 mt-1.5">{errors.location}</p>}
          {form.location === 'Other' && (
            <input
              type="text"
              value={form.customLocation}
              onChange={(e) => update({ customLocation: e.target.value })}
              placeholder="Enter custom location"
              className="input mt-2"
            />
          )}
          {errors.customLocation && (
            <p className="text-xs text-critical-600 mt-1.5">{errors.customLocation}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="label" htmlFor="r-desc">
            Description
          </label>
          <textarea
            id="r-desc"
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="Describe what happened..."
            rows={4}
            className="input resize-none"
          />
          {errors.description && (
            <p className="text-xs text-critical-600 mt-1.5">{errors.description}</p>
          )}
        </div>

        {/* Initial notes */}
        <div>
          <label className="label" htmlFor="r-notes">
            Initial Notes <span className="text-ink-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="r-notes"
            value={form.initialNotes}
            onChange={(e) => update({ initialNotes: e.target.value })}
            placeholder="Any immediate additional context..."
            rows={2}
            className="input resize-none"
          />
        </div>
      </div>
    </Modal>
  );
}
