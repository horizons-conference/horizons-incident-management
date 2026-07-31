import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Clock,
  User,
  UserCheck,
  CheckCircle2,
  Loader2,
  Send,
  History,
  Trash2,
  ShieldAlert,
  Pencil,
  Hand,
  MessageSquare,
} from 'lucide-react';
import { useIncidentDetail, useUsers, useCategories, useIncidentMessages } from '@/hooks/useIncidents';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { PriorityBadge, StatusBadge, TypeBadge } from '@/components/Badges';
import { ConfirmDialog, Modal } from '@/components/Modal';
import { PRIORITY_META, STATUS_META, PRIORITIES, STATUSES } from '@/lib/constants';
import { formatTime, formatDate, formatDateTimeLocal, resolutionTimeMinutes, formatDuration, formatRelative } from '@/lib/format';
import type { IncidentPriority, IncidentStatus, IncidentType } from '@/lib/types';

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { incident, history, loading, reload } = useIncidentDetail(id);
  const { messages, loading: messagesLoading, reload: reloadMessages } = useIncidentMessages(id);
  const { profile } = useAuth();
  const { toast } = useToast();
  const { users } = useUsers();
  const { categories } = useCategories();
  const isAdmin = profile?.role === 'admin';

  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mark messages as read when viewing (admin only — staff can't update)
  useEffect(() => {
    if (!isAdmin || !id || messages.length === 0) return;
    const unread = messages.filter((m) => !m.read_at && m.sender_id !== profile?.id);
    if (unread.length === 0) return;
    (async () => {
      await supabase
        .from('incident_messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unread.map((m) => m.id))
        .is('read_at', null);
      reloadMessages();
    })();
  }, [id, isAdmin, messages, profile?.id, reloadMessages]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-ink-400" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="card p-10 text-center">
        <p className="text-ink-500">Incident not found or you don't have access to this incident.</p>
        <Link to="/incidents" className="btn-secondary mt-4 inline-flex">
          Back to incidents
        </Link>
      </div>
    );
  }

  const isCritical = incident.priority === 'critical';
  const pm = PRIORITY_META[incident.priority];

  // Audit history is now recorded automatically by database triggers.
  // These functions only update the incidents/incident_notes tables.

  const addNote = async () => {
    if (!noteText.trim() || !profile) return;
    setAddingNote(true);
    const { error } = await supabase.from('incident_notes').insert({
      incident_id: incident.id,
      author_id: profile.id,
      note: noteText.trim(),
    });
    if (error) {
      toast('Failed to add note', 'error');
      setAddingNote(false);
      return;
    }
    setNoteText('');
    setAddingNote(false);
    toast('Note added', 'success');
    reload();
  };

  const changeStatus = async (newStatus: IncidentStatus) => {
    if (!profile || newStatus === incident.status) return;
    setUpdating(true);
    const patch: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'resolved') {
      patch.resolved_at = new Date().toISOString();
      patch.resolved_by = profile.id;
    } else {
      patch.resolved_at = null;
      patch.resolved_by = null;
    }
    const { error } = await supabase.from('incidents').update(patch).eq('id', incident.id);
    if (error) {
      toast('Failed to update status', 'error');
      setUpdating(false);
      return;
    }
    setUpdating(false);
    toast('Status updated successfully', 'success');
    reload();
  };

  const changePriority = async (newPriority: IncidentPriority) => {
    if (!profile || newPriority === incident.priority) return;
    setUpdating(true);
    const { error } = await supabase
      .from('incidents')
      .update({ priority: newPriority })
      .eq('id', incident.id);
    if (error) {
      toast('Failed to update priority', 'error');
      setUpdating(false);
      return;
    }
    setUpdating(false);
    toast('Priority updated', 'success');
    reload();
  };

  const assignIncident = async () => {
    if (!profile || !isAdmin) return;
    setUpdating(true);
    const newAssignee = assigneeId || null;
    const { error } = await supabase
      .from('incidents')
      .update({ assigned_to: newAssignee })
      .eq('id', incident.id);
    if (error) {
      toast('Failed to assign incident', 'error');
      setUpdating(false);
      return;
    }
    setUpdating(false);
    setShowAssign(false);
    toast('Incident assigned', 'success');
    reload();
  };

  const claimIncident = async () => {
    if (!profile || !isAdmin) return;
    setUpdating(true);
    const { error } = await supabase
      .from('incidents')
      .update({
        claimed_by: profile.id,
        claimed_at: new Date().toISOString(),
        assigned_to: incident.assigned_to ?? profile.id,
      })
      .eq('id', incident.id);
    if (error) {
      toast('Failed to claim incident', 'error');
      setUpdating(false);
      return;
    }
    setUpdating(false);
    toast('Incident claimed', 'success');
    reload();
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !profile) return;
    setSendingMessage(true);
    const { error } = await supabase.from('incident_messages').insert({
      incident_id: incident.id,
      sender_id: profile.id,
      body: messageText.trim(),
    });
    if (error) {
      toast('Failed to send message', 'error');
      setSendingMessage(false);
      return;
    }
    setMessageText('');
    setSendingMessage(false);
    reloadMessages();
  };

  const acknowledge = async () => {
    if (!profile) return;
    setUpdating(true);
    const { error } = await supabase
      .from('incidents')
      .update({
        acknowledged: true,
        acknowledged_by: profile.id,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', incident.id);
    if (error) {
      toast('Failed to acknowledge', 'error');
      setUpdating(false);
      return;
    }
    setUpdating(false);
    toast('Incident acknowledged', 'success');
    reload();
  };

  const deleteIncident = async () => {
    const { error } = await supabase.from('incidents').delete().eq('id', incident.id);
    if (error) {
      toast('Failed to delete incident', 'error');
      return;
    }
    toast('Incident deleted', 'success');
    navigate('/incidents');
  };

  const notes = [...(incident.incident_notes ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const resTime =
    incident.resolved_at && incident.resolved_by
      ? resolutionTimeMinutes(incident.created_at, incident.resolved_at)
      : null;

  return (
    <div className="space-y-5 max-w-3xl mx-auto pb-20 lg:pb-0">
      <Link
        to="/incidents"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <div className={`card overflow-hidden ${isCritical ? 'ring-2 ring-critical-400/50' : ''}`}>
        <div className={`h-1.5 ${pm.dot}`} />
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-sm font-bold text-ink-400">
              Incident #{incident.incident_number}
            </span>
            <PriorityBadge priority={incident.priority} />
            <StatusBadge status={incident.status} />
            {isCritical && (
              <span
                className={`badge ${
                  incident.acknowledged
                    ? 'bg-low-50 text-low-700 border border-low-200'
                    : 'bg-critical-50 text-critical-700 border border-critical-200 animate-pulse'
                }`}
              >
                {incident.acknowledged ? 'Acknowledged' : 'Not Acknowledged'}
              </span>
            )}
          </div>

          <div className="mb-3">
            <TypeBadge type={incident.type} />
          </div>

          <h1 className="text-2xl font-extrabold text-ink-900 leading-tight mb-4">
            {incident.title}
          </h1>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-ink-100">
            <MetaItem icon={<Clock className="w-4 h-4" />} label="Time" value={formatTime(incident.created_at)} sub={formatDate(incident.created_at)} />
            <MetaItem icon={<MapPin className="w-4 h-4" />} label="Location" value={incident.location} />
            <MetaItem icon={<User className="w-4 h-4" />} label="Reported by" value={incident.reporter?.name ?? 'Unknown'} sub={incident.reporter?.title ?? undefined} />
            <MetaItem icon={<UserCheck className="w-4 h-4" />} label="Assigned to" value={incident.assignee?.name ?? 'Unassigned'} sub={incident.assignee?.title ?? undefined} />
          </div>

          {incident.claimed_by && (
            <div className="mt-4 pt-4 border-t border-ink-100">
              <div className="inline-flex items-center gap-2 text-sm bg-brand-50 text-brand-700 border border-brand-200 rounded-full px-3 py-1.5">
                <Hand className="w-4 h-4" />
                <span className="font-semibold">Managed by {incident.claimer?.name ?? 'Unknown'}</span>
                {incident.claimed_at && (
                  <span className="text-brand-500 text-xs">· Claimed {formatDateTimeLocal(incident.claimed_at)}</span>
                )}
              </div>
            </div>
          )}

          {resTime !== null && (
            <div className="mt-4 pt-4 border-t border-ink-100">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-low-600" />
                <span className="text-ink-700">
                  Resolved by <span className="font-semibold">{incident.resolver?.name ?? 'Unknown'}</span> in{' '}
                  <span className="font-semibold">{formatDuration(resTime)}</span>
                </span>
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {isCritical && !incident.acknowledged && (
              <button className="btn-primary" onClick={acknowledge} disabled={updating}>
                <ShieldAlert className="w-4 h-4" />
                Acknowledge
              </button>
            )}
            {isAdmin && !incident.claimed_by && (
              <button className="btn-primary" onClick={claimIncident} disabled={updating}>
                <Hand className="w-4 h-4" />
                Claim Incident
              </button>
            )}
            {isAdmin && (
              <button className="btn-secondary" onClick={() => setShowAssign(true)}>
                <UserCheck className="w-4 h-4" />
                {incident.assigned_to ? 'Reassign' : 'Assign'}
              </button>
            )}
            {isAdmin && (
              <button className="btn-ghost" onClick={() => setShowEdit(true)}>
                <Pencil className="w-4 h-4" />
                Edit
              </button>
            )}
            {isAdmin && (
              <button className="btn-ghost text-critical-600 hover:bg-critical-50" onClick={() => setShowDelete(true)}>
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-bold text-ink-500 uppercase tracking-wide mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Conversation
        </h2>
        <div className="space-y-3 mb-4 max-h-80 overflow-y-auto pr-1">
          {messagesLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-ink-400" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-ink-400 text-center py-4">No messages yet. Start the conversation below.</p>
          ) : (
            messages.map((m) => {
              const isOwn = m.sender_id === profile?.id;
              const senderName = m.sender?.name ?? 'Unknown';
              const unread = !m.read_at && !isOwn;
              return (
                <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    <div className="flex items-center gap-1.5 text-xs text-ink-400">
                      {!isOwn && <span className="font-semibold text-ink-600">{senderName}</span>}
                      {unread && <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />}
                    </div>
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        isOwn
                          ? 'bg-brand-600 text-white rounded-br-sm'
                          : 'bg-ink-100 text-ink-800 rounded-bl-sm'
                      }`}
                    >
                      {m.body}
                    </div>
                    <span className="text-xs text-ink-400 px-1">{formatTime(m.created_at)}</span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="border-t border-ink-100 pt-3">
          <div className="flex gap-2">
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message..."
              rows={2}
              className="input resize-none flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button onClick={sendMessage} disabled={sendingMessage || !messageText.trim()} className="btn-primary self-stretch px-4">
              {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-ink-400 mt-1.5">
            {isAdmin ? 'Reply to the reporting staff member.' : 'Messages are sent to the Secretariat team.'}
          </p>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-bold text-ink-500 uppercase tracking-wide mb-3">Status & Priority Controls</h2>
        <div className="space-y-4">
          <div>
            <label className="label">Status</label>
            <div className="grid grid-cols-3 gap-2">
              {STATUSES.map((s) => {
                const m = STATUS_META[s];
                const active = incident.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => changeStatus(s)}
                    disabled={updating || active}
                    className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-semibold transition-all disabled:opacity-60 ${
                      active
                        ? `${m.bg} ${m.text} ${m.border} border-2 ring-2 ${m.text}/10`
                        : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50 text-ink-600'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${m.dot}`} />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="label">Priority</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRIORITIES.map((p) => {
                const m = PRIORITY_META[p];
                const active = incident.priority === p;
                return (
                  <button
                    key={p}
                    onClick={() => changePriority(p)}
                    disabled={updating || active}
                    className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-sm font-semibold transition-all disabled:opacity-60 ${
                      active
                        ? `${m.bg} ${m.text} ${m.border} border-2`
                        : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50 text-ink-600'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${m.dot}`} />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-bold text-ink-500 uppercase tracking-wide mb-3">Description</h2>
        <p className="text-sm text-ink-800 leading-relaxed whitespace-pre-wrap">{incident.description}</p>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-bold text-ink-500 uppercase tracking-wide mb-4">Notes & Timeline</h2>
        <div className="space-y-3 mb-4">
          <TimelineEntry time={incident.created_at} author={incident.reporter?.name ?? 'Unknown'} text="Incident created" isSystem />
          {notes.map((n) => (
            <TimelineEntry key={n.id} time={n.created_at} author={n.author?.name ?? 'Unknown'} text={n.note} />
          ))}
          {history
            .filter((h) => h.action !== 'Incident created' && h.action !== 'Note added')
            .map((h) => (
              <TimelineEntry key={h.id} time={h.timestamp} author={h.user?.name ?? 'Unknown'} text={formatHistoryAction(h.action, h.old_value, h.new_value)} isSystem />
            ))}
        </div>
        <div className="border-t border-ink-100 pt-4">
          <label className="label">Add a note</label>
          <div className="flex gap-2">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Type an update..."
              rows={2}
              className="input resize-none flex-1"
            />
            <button onClick={addNote} disabled={addingNote || !noteText.trim()} className="btn-primary self-stretch px-4">
              {addingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="card p-5">
          <h2 className="text-sm font-bold text-ink-500 uppercase tracking-wide mb-4 flex items-center gap-2">
            <History className="w-4 h-4" />
            Audit History
          </h2>
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-start gap-3 text-sm py-2 border-b border-ink-50 last:border-0">
                <span className="text-xs text-ink-400 tabular-nums shrink-0 w-20">{formatTime(h.timestamp)}</span>
                <div className="flex-1">
                  <span className="font-semibold text-ink-800">{h.user?.name ?? 'Unknown'}</span>{' '}
                  <span className="text-ink-600">{formatHistoryAction(h.action, h.old_value, h.new_value).toLowerCase()}</span>
                </div>
              </div>
            ))}
            {history.length === 0 && <p className="text-sm text-ink-400">No history recorded.</p>}
          </div>
        </div>
      )}

      <Modal
        open={showAssign}
        onClose={() => setShowAssign(false)}
        title="Assign / Transfer Incident"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowAssign(false)}>Cancel</button>
            <button className="btn-primary" onClick={assignIncident} disabled={updating}>
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </button>
          </>
        }
      >
        <label className="label">Assign to Secretariat member</label>
        <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="input">
          <option value="">Unassigned</option>
          {users.filter((u) => u.role === 'admin').map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} {u.title ? `— ${u.title}` : ''}
            </option>
          ))}
        </select>
      </Modal>

      {isAdmin && (
        <EditIncidentModal open={showEdit} onClose={() => setShowEdit(false)} incident={incident} categories={categories} onSaved={reload} />
      )}

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={deleteIncident}
        title="Delete Incident"
        message={`Are you sure you want to delete Incident #${incident.incident_number}? This action cannot be undone and will remove all notes and history.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

function MetaItem({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-400 uppercase tracking-wide mb-1">
        {icon}
        {label}
      </div>
      <p className="text-sm font-semibold text-ink-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-ink-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function TimelineEntry({ time, author, text, isSystem }: { time: string; author: string; text: string; isSystem?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSystem ? 'bg-ink-100 text-ink-500' : 'bg-brand-50 text-brand-600'}`}>
          {isSystem ? <History className="w-4 h-4" /> : <User className="w-4 h-4" />}
        </div>
      </div>
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-semibold text-ink-900">{author}</span>
          <span className="text-xs text-ink-400">{formatTime(time)}</span>
        </div>
        <p className={`text-sm leading-relaxed mt-0.5 ${isSystem ? 'text-ink-500 italic' : 'text-ink-700'}`}>{text}</p>
      </div>
    </div>
  );
}

function formatHistoryAction(action: string, oldVal: string | null, newVal: string | null): string {
  if (action === 'Status changed' || action === 'Priority changed' || action === 'Assignment changed') {
    const from = oldVal ?? '—';
    const to = newVal ?? '—';
    return `${action}: ${from} → ${to}`;
  }
  if (action === 'Note added' && newVal) return `Added note: "${newVal}"`;
  return action;
}

function EditIncidentModal({
  open,
  onClose,
  incident,
  categories,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  incident: NonNullable<ReturnType<typeof useIncidentDetail>['incident']>;
  categories: { key: string; label: string; icon: string; active: boolean }[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: incident.type,
    priority: incident.priority,
    title: incident.title,
    location: incident.location,
    description: incident.description,
  });

  const update = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });
  const activeCategories = categories.filter((c) => c.active);

  const save = async () => {
    setSaving(true);
    // Audit history is recorded automatically by the trg_incident_audit trigger.
    const { error } = await supabase
      .from('incidents')
      .update({
        type: form.type,
        priority: form.priority,
        title: form.title.trim(),
        location: form.location.trim(),
        description: form.description.trim(),
      })
      .eq('id', incident.id);

    if (error) {
      toast('Failed to save changes', 'error');
      setSaving(false);
      return;
    }

    setSaving(false);
    toast('Incident updated', 'success');
    onSaved();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Incident"
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Type</label>
            <select value={form.type} onChange={(e) => update({ type: e.target.value as IncidentType })} className="input">
              {activeCategories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select value={form.priority} onChange={(e) => update({ priority: e.target.value as IncidentPriority })} className="input">
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Title</label>
          <input type="text" value={form.title} onChange={(e) => update({ title: e.target.value })} className="input" />
        </div>
        <div>
          <label className="label">Location</label>
          <input type="text" value={form.location} onChange={(e) => update({ location: e.target.value })} className="input" />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea value={form.description} onChange={(e) => update({ description: e.target.value })} rows={4} className="input resize-none" />
        </div>
      </div>
    </Modal>
  );
}
