import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import { Loader2, Settings as SettingsIcon, Download, Tag, Plus, Trash2, GripVertical } from 'lucide-react';
import { useIncidents, useCategories } from '@/hooks/useIncidents';
import { TYPE_META, PRIORITY_META } from '@/lib/constants';
import { formatDuration, resolutionTimeMinutes, toCsv } from '@/lib/format';
import type { IncidentCategory } from '@/lib/types';

export function SettingsPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { incidents } = useIncidents();
  const { categories, reload: reloadCategories } = useCategories();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: profile?.name ?? '',
    title: profile?.title ?? '',
  });

  if (profile && profile.role !== 'admin') return <Navigate to="/" replace />;

  const update = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        name: form.name.trim(),
        title: form.title.trim() || null,
      })
      .eq('id', profile.id);
    if (error) {
      toast('Failed to save settings', 'error');
      setSaving(false);
      return;
    }
    toast('Settings saved', 'success');
    setSaving(false);
  };

  const exportAll = () => {
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

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold text-ink-900 tracking-tight">Settings</h1>
        <p className="text-sm text-ink-500 mt-0.5">System configuration and profile</p>
      </div>

      {/* Profile */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-ink-500 uppercase tracking-wide mb-4">Your Profile</h2>
        <div className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update({ title: e.target.value })}
              className="input"
            />
          </div>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save Profile
          </button>
        </div>
      </div>

      {/* Incident Categories */}
      <CategoriesManager categories={categories} reload={reloadCategories} />

      {/* Export */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-ink-500 uppercase tracking-wide mb-2">Data Export</h2>
        <p className="text-sm text-ink-500 mb-4">
          Export all incident data as a CSV file for post-conference reporting.
        </p>
        <button className="btn-secondary" onClick={exportAll}>
          <Download className="w-4 h-4" />
          Export All Incidents
        </button>
      </div>

      {/* System info */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-ink-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <SettingsIcon className="w-4 h-4" />
          System Information
        </h2>
        <dl className="text-sm space-y-2">
          <div className="flex justify-between">
            <dt className="text-ink-500">Conference</dt>
            <dd className="font-semibold text-ink-900">CAHSMUN Horizons 2026</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">Total incidents</dt>
            <dd className="font-semibold text-ink-900 tabular-nums">{incidents.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">Your role</dt>
            <dd className="font-semibold text-ink-900 capitalize">{profile?.role}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function CategoriesManager({
  categories,
  reload,
}: {
  categories: IncidentCategory[];
  reload: () => void;
}) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [newCat, setNewCat] = useState({ label: '', icon: '📢', key: '' });
  const [saving, setSaving] = useState(false);

  const toggleActive = async (cat: IncidentCategory) => {
    const { error } = await supabase
      .from('incident_categories')
      .update({ active: !cat.active })
      .eq('id', cat.id);
    if (error) {
      toast('Failed to update category', 'error');
      return;
    }
    toast('Category updated', 'success');
    reload();
  };

  const updateLabel = async (cat: IncidentCategory, label: string) => {
    const { error } = await supabase
      .from('incident_categories')
      .update({ label })
      .eq('id', cat.id);
    if (error) {
      toast('Failed to update label', 'error');
      return;
    }
    reload();
  };

  const removeCategory = async (cat: IncidentCategory) => {
    const { error } = await supabase
      .from('incident_categories')
      .delete()
      .eq('id', cat.id);
    if (error) {
      toast('Failed to remove category', 'error');
      return;
    }
    toast('Category removed', 'success');
    reload();
  };

  const addCategory = async () => {
    if (!newCat.label.trim() || !newCat.key.trim()) {
      toast('Label and key are required', 'error');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('incident_categories').insert({
      key: newCat.key.trim().toLowerCase().replace(/\s+/g, '_'),
      label: newCat.label.trim(),
      icon: newCat.icon || '📢',
      active: true,
      sort_order: categories.length + 1,
    });
    if (error) {
      toast(error.message, 'error');
      setSaving(false);
      return;
    }
    toast('Category added', 'success');
    setNewCat({ label: '', icon: '📢', key: '' });
    setSaving(false);
    setShowAdd(false);
    reload();
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-ink-500 uppercase tracking-wide flex items-center gap-2">
          <Tag className="w-4 h-4" />
          Incident Categories
        </h2>
        <button className="btn-secondary text-xs" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 p-3 rounded-lg bg-ink-50 border border-ink-200 animate-fade-in">
          <div className="grid grid-cols-3 gap-2 mb-2">
            <input
              type="text"
              value={newCat.icon}
              onChange={(e) => setNewCat({ ...newCat, icon: e.target.value })}
              className="input py-2 text-center text-lg"
              placeholder="Icon"
              maxLength={2}
            />
            <input
              type="text"
              value={newCat.label}
              onChange={(e) => setNewCat({ ...newCat, label: e.target.value })}
              className="input py-2"
              placeholder="Label (e.g. Medical)"
            />
            <input
              type="text"
              value={newCat.key}
              onChange={(e) => setNewCat({ ...newCat, key: e.target.value })}
              className="input py-2"
              placeholder="Key (e.g. medical)"
            />
          </div>
          <button className="btn-primary text-xs" onClick={addCategory} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Save Category
          </button>
        </div>
      )}

      <div className="space-y-2">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className={`flex items-center gap-3 p-2.5 rounded-lg border ${
              cat.active ? 'border-ink-200 bg-white' : 'border-ink-100 bg-ink-50 opacity-60'
            }`}
          >
            <GripVertical className="w-4 h-4 text-ink-300 shrink-0" />
            <span className="text-lg shrink-0" aria-hidden>
              {cat.icon}
            </span>
            <input
              type="text"
              value={cat.label}
              onChange={(e) => updateLabel(cat, e.target.value)}
              className="input py-1.5 text-sm flex-1"
              disabled={!cat.active}
            />
            <span className="text-xs font-mono text-ink-400 shrink-0">{cat.key}</span>
            <button
              onClick={() => toggleActive(cat)}
              className="btn-ghost text-xs shrink-0"
            >
              {cat.active ? 'Hide' : 'Show'}
            </button>
            <button
              onClick={() => removeCategory(cat)}
              className="btn-ghost text-critical-600 hover:bg-critical-50 shrink-0"
              aria-label="Remove category"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
