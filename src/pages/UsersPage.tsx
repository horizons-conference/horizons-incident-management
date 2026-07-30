import { useState } from 'react';
import { useUsers } from '@/hooks/useIncidents';
import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Loader2, UserPlus, Trash2, Shield } from 'lucide-react';
import { Modal, ConfirmDialog } from '@/components/Modal';
import type { UserRole } from '@/lib/types';

export function UsersPage() {
  const { users, loading, reload } = useUsers();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [deleteUser, setDeleteUser] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (profile && profile.role !== 'admin') return <Navigate to="/" replace />;

  const updateRole = async (userId: string, role: UserRole) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (error) {
      toast('Failed to update role', 'error');
      return;
    }
    toast('User role updated', 'success');
    reload();
  };

  const toggleActive = async (userId: string, active: boolean) => {
    const { error } = await supabase.from('profiles').update({ active: !active }).eq('id', userId);
    if (error) {
      toast('Failed to update user', 'error');
      return;
    }
    toast(`User ${!active ? 'activated' : 'deactivated'}`, 'success');
    reload();
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session.session?.access_token;
      if (!accessToken) {
        toast('Not authenticated', 'error');
        setDeleting(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ user_id: deleteUser.id }),
        },
      );

      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error ?? `Request failed (${response.status})`);
      }

      toast('User removed', 'success');
      setDeleteUser(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove user', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900 tracking-tight">Users</h1>
          <p className="text-sm text-ink-500 mt-0.5">Manage staff members</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-ink-400" />
        </div>
      ) : (
        <div className="card divide-y divide-ink-100">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-4">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                  u.role === 'admin' ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-600'
                }`}
              >
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-ink-900 truncate">{u.name}</p>
                  {u.role === 'admin' && (
                    <span className="badge bg-brand-50 text-brand-700 border border-brand-200">
                      <Shield className="w-3 h-3" />
                      Admin
                    </span>
                  )}
                  {!u.active && (
                    <span className="badge bg-ink-100 text-ink-500 border border-ink-200">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-500 truncate">
                  {u.email}
                  {u.department ? ` · ${u.department}` : ''}
                  {u.title ? ` · ${u.title}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={u.role}
                  onChange={(e) => updateRole(u.id, e.target.value as UserRole)}
                  className="input py-1.5 text-xs w-auto"
                  disabled={u.id === profile?.id}
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  onClick={() => toggleActive(u.id, u.active)}
                  className="btn-ghost text-xs"
                  disabled={u.id === profile?.id}
                >
                  {u.active ? 'Deactivate' : 'Activate'}
                </button>
                {u.id !== profile?.id && (
                  <button
                    onClick={() => setDeleteUser({ id: u.id, name: u.name })}
                    className="btn-ghost text-critical-600 hover:bg-critical-50"
                    aria-label="Remove user"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddUserModal open={showAdd} onClose={() => setShowAdd(false)} onAdded={reload} />

      <ConfirmDialog
        open={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={handleDelete}
        title="Remove User"
        message={`Are you sure you want to permanently remove ${deleteUser?.name ?? 'this user'}? This will revoke their access and cannot be undone.`}
        confirmLabel={deleting ? 'Removing...' : 'Remove'}
        danger
      />
    </div>
  );
}

function AddUserModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
    title: '',
  });

  const update = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });

  const save = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast('Name, email, and password are required', 'error');
      return;
    }
    if (form.password.length < 6) {
      toast('Password must be at least 6 characters', 'error');
      return;
    }
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session.session?.access_token;
      if (!accessToken) {
        toast('Not authenticated', 'error');
        setSaving(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            email: form.email.trim(),
            password: form.password,
            name: form.name.trim(),
            department: form.department.trim() || null,
            title: form.title.trim() || null,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error ?? `Request failed (${response.status})`);
      }

      toast('User created successfully', 'success');
      setForm({ name: '', email: '', password: '', department: '', title: '' });
      onAdded();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create user', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add New User"
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Create User
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">Full Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update({ name: e.target.value })}
            className="input"
            placeholder="e.g. Sarah Lee"
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => update({ email: e.target.value })}
            className="input"
            placeholder="name@horizons2026.ca"
          />
        </div>
        <div>
          <label className="label">Temporary Password</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => update({ password: e.target.value })}
            className="input"
            placeholder="Min 6 characters"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Department</label>
            <input
              type="text"
              value={form.department}
              onChange={(e) => update({ department: e.target.value })}
              className="input"
              placeholder="e.g. Logistics"
            />
          </div>
          <div>
            <label className="label">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update({ title: e.target.value })}
              className="input"
              placeholder="e.g. Under-Secretary"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
