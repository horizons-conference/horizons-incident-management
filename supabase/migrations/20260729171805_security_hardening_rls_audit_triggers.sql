/*
# Security Hardening: RLS Tightening, Audit Triggers, Role Escalation Fixes

## Overview
Closes four security vulnerabilities:
1. Profile role escalation — users could self-promote to admin.
2. Admin account creation hole — public signup could set arbitrary roles.
3. Incident editing permissions — any staff could edit structural fields.
4. Audit log forgery — clients could INSERT arbitrary history entries.

## Changes

### 1. Profile Role Escalation Fix (Critical 1)
- Splits update policy into `profiles_update_self` (own row) and
  `profiles_update_admin` (any row, any field).
- Adds a BEFORE UPDATE trigger that strips `role` from non-admin updates
  as defense-in-depth.

### 2. Admin Account Creation Hole (Critical 2)
- Rewrites `handle_new_user()` to always insert `role = 'staff'`,
  ignoring any role supplied in signup metadata.

### 3. Incident Editing Permissions (Critical 3)
- Replaces the open `incidents_update_staff` policy with
  `incidents_update_operational`. Uses a SECURITY DEFINER helper
  `incident_structure_unchanged()` to compare the incoming new values
  against the stored row (RLS WITH CHECK references columns by name,
  not via OLD, so we compare against the current DB row).
- Adds a BEFORE UPDATE trigger that blocks structural edits by non-admins.

### 4. Audit Log Forgery (Medium 6)
- Drops the client INSERT policy on `incident_history`.
- Adds AFTER INSERT/UPDATE triggers on `incidents` and AFTER INSERT on
  `incident_notes` to automatically record audit entries.

## Helper functions
- `is_admin()` — SECURITY DEFINER, checks if auth.uid() has admin role.
- `incident_structure_unchanged()` — SECURITY DEFINER, compares new
  structural fields against the stored row for the given incident id.
*/

-- ============================================================
-- Helper: is_admin()
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- ============================================================
-- 1. Profile role escalation fix
-- ============================================================

drop policy if exists "profiles_update_own_or_admin" on profiles;
drop policy if exists "profiles_update_self" on profiles;
drop policy if exists "profiles_update_admin" on profiles;

-- Self-update: can update own profile (trigger protects role column)
create policy "profiles_update_self"
  on profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admin update: can update any profile including role
create policy "profiles_update_admin"
  on profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Defense-in-depth: strip role changes from non-admins
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_role on profiles;
create trigger trg_protect_profile_role
  before update on profiles
  for each row execute function public.protect_profile_role();

-- ============================================================
-- 2. Admin account creation hole fix
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Always default to 'staff'. Role escalation only via admin edge function.
  insert into public.profiles (id, name, email, role, department, title)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'staff',
    new.raw_user_meta_data->>'department',
    new.raw_user_meta_data->>'title'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ============================================================
-- 3. Incident editing permissions fix
-- ============================================================

-- Helper: check if structural fields match the stored row.
-- RLS WITH CHECK references columns by bare name (not NEW/OLD), so we
-- pass the incoming column values and compare against the stored row.
create or replace function public.incident_structure_unchanged(
  p_id uuid,
  p_title text,
  p_type incident_type,
  p_location text,
  p_description text,
  p_priority incident_priority
) returns boolean
language sql
security definer set search_path = public
as $$
  select exists (
    select 1 from public.incidents i
    where i.id = p_id
      and i.title = p_title
      and i.type = p_type
      and i.location = p_location
      and i.description = p_description
      and i.priority = p_priority
  );
$$;

drop policy if exists "incidents_update_staff" on incidents;
drop policy if exists "incidents_update_operational" on incidents;

-- Staff can update operational fields; structural fields require admin.
-- WITH CHECK references columns by bare name (the new row values).
create policy "incidents_update_operational"
  on incidents for update
  to authenticated
  using (true)
  with check (
    public.is_admin()
    or public.incident_structure_unchanged(
      id, title, type, location, description, priority
    )
  );

-- Defense-in-depth trigger: block structural edits by non-admins
create or replace function public.protect_incident_structure()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.title <> old.title
       or new.type <> old.type
       or new.location <> old.location
       or new.description <> old.description
       or new.priority <> old.priority then
      raise exception 'Permission denied: only administrators can edit incident details';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_incident_structure on incidents;
create trigger trg_protect_incident_structure
  before update on incidents
  for each row execute function public.protect_incident_structure();

-- ============================================================
-- 4. Audit log forgery fix
-- ============================================================

-- Remove all client-side INSERT access to incident_history
drop policy if exists "history_insert_actor" on incident_history;

-- Audit trigger for incidents: log creates and field changes
create or replace function public.audit_incident()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if TG_OP = 'INSERT' then
    insert into public.incident_history (incident_id, user_id, action, old_value, new_value, timestamp)
    values (new.id, actor, 'Incident created', null, null, now());
    return new;
  elsif TG_OP = 'UPDATE' then
    if old.status <> new.status then
      insert into public.incident_history (incident_id, user_id, action, old_value, new_value, timestamp)
      values (new.id, actor, 'Status changed', old.status::text, new.status::text, now());
    end if;
    if old.priority <> new.priority then
      insert into public.incident_history (incident_id, user_id, action, old_value, new_value, timestamp)
      values (new.id, actor, 'Priority changed', old.priority::text, new.priority::text, now());
    end if;
    if old.assigned_to is distinct from new.assigned_to then
      insert into public.incident_history (incident_id, user_id, action, old_value, new_value, timestamp)
      values (new.id, actor, 'Assignment changed', old.assigned_to::text, new.assigned_to::text, now());
    end if;
    if old.acknowledged <> new.acknowledged then
      insert into public.incident_history (incident_id, user_id, action, old_value, new_value, timestamp)
      values (new.id, actor, 'Incident acknowledged', old.acknowledged::text, new.acknowledged::text, now());
    end if;
    if old.resolved_at is null and new.resolved_at is not null then
      insert into public.incident_history (incident_id, user_id, action, old_value, new_value, timestamp)
      values (new.id, actor, 'Incident resolved', null, new.resolved_at::text, now());
    end if;
    if old.title <> new.title then
      insert into public.incident_history (incident_id, user_id, action, old_value, new_value, timestamp)
      values (new.id, actor, 'Title edited', old.title, new.title, now());
    end if;
    if old.type <> new.type then
      insert into public.incident_history (incident_id, user_id, action, old_value, new_value, timestamp)
      values (new.id, actor, 'Type edited', old.type::text, new.type::text, now());
    end if;
    if old.location <> new.location then
      insert into public.incident_history (incident_id, user_id, action, old_value, new_value, timestamp)
      values (new.id, actor, 'Location edited', old.location, new.location, now());
    end if;
    if old.description <> new.description then
      insert into public.incident_history (incident_id, user_id, action, old_value, new_value, timestamp)
      values (new.id, actor, 'Description edited', old.description, new.description, now());
    end if;
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_incident_audit on incidents;
create trigger trg_incident_audit
  after insert or update on incidents
  for each row execute function public.audit_incident();

-- Audit trigger for incident_notes: log note additions
create or replace function public.audit_incident_note()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.incident_history (incident_id, user_id, action, old_value, new_value, timestamp)
  values (new.incident_id, new.author_id, 'Note added', null, new.note, now());
  return new;
end;
$$;

drop trigger if exists trg_incident_note_audit on incident_notes;
create trigger trg_incident_note_audit
  after insert on incident_notes
  for each row execute function public.audit_incident_note();
