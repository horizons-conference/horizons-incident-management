import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import type { Incident, Profile, IncidentNote, IncidentHistory, IncidentCategory } from '@/lib/types';

export interface IncidentDetail extends Incident {
  incident_notes: IncidentNote[];
}

export function useUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('name');
    setUsers((data ?? []) as Profile[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { users, loading, reload: load };
}

export function useCategories() {
  const [categories, setCategories] = useState<IncidentCategory[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('incident_categories')
      .select('*')
      .order('sort_order');
    if (data && data.length > 0) {
      setCategories(data as IncidentCategory[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { categories, loading, reload: load };
}

export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('incidents')
      .select(
        'id, incident_number, type, priority, title, location, description, reporter_id, assigned_to, status, acknowledged, acknowledged_by, acknowledged_at, created_at, updated_at, resolved_at, resolved_by, reporter:profiles!incidents_reporter_id_fkey(id, name, email, role, department, title), assignee:profiles!incidents_assigned_to_fkey(id, name, email, role, department, title), acknowledger:profiles!incidents_acknowledged_by_fkey(id, name), resolver:profiles!incidents_resolved_by_fkey(id, name), incident_notes(id, note)',
      )
      .order('created_at', { ascending: false });
    setIncidents((data ?? []) as unknown as Incident[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();

    const channel = supabase
      .channel('incidents-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, () => {
        load();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incident_notes' }, () => {
        load();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { incidents, loading, reload: load };
}

export function useIncidentDetail(id: string | undefined) {
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [history, setHistory] = useState<IncidentHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('incidents')
      .select(
        'id, incident_number, type, priority, title, location, description, reporter_id, assigned_to, status, acknowledged, acknowledged_by, acknowledged_at, created_at, updated_at, resolved_at, resolved_by, reporter:profiles!incidents_reporter_id_fkey(id, name, email, role, department, title), assignee:profiles!incidents_assigned_to_fkey(id, name, email, role, department, title), acknowledger:profiles!incidents_acknowledged_by_fkey(id, name), resolver:profiles!incidents_resolved_by_fkey(id, name), incident_notes(id, incident_id, author_id, note, created_at, author:profiles!incident_notes_author_id_fkey(id, name))',
      )
      .eq('id', id)
      .maybeSingle();

    setIncident((data as unknown as IncidentDetail) ?? null);

    const { data: hist } = await supabase
      .from('incident_history')
      .select(
        'id, incident_id, user_id, action, old_value, new_value, timestamp, user:profiles!incident_history_user_id_fkey(id, name)',
      )
      .eq('incident_id', id)
      .order('timestamp', { ascending: true });

    setHistory((hist ?? []) as unknown as IncidentHistory[]);

    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();

    if (!id) return;
    const channel = supabase
      .channel(`incident-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents', filter: `id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incident_notes', filter: `incident_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incident_history', filter: `incident_id=eq.${id}` }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  return { incident, history, loading, reload: load };
}
