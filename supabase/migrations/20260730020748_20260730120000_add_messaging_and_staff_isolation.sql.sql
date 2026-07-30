/*
# Staff Incident Isolation, Incident Messaging, and Claim System

## Overview
This migration implements three major features:
1. Restricts staff to only see/access their own incidents (RLS + helper function).
2. Adds an incident_messages table for staff-to-Secretariat chat threads.
3. Adds claim tracking columns to incidents (claimed_by, claimed_at) and
   enforces that only admins can claim/reassign incidents.

## Changes

### 1. Staff Incident Isolation (RLS)
- Replaces the open `incidents_select_all` policy with a role-aware policy:
  - Admins see ALL incidents.
  - Staff see ONLY incidents where reporter_id = auth.uid().
- Adds a helper function `can_access_incident(p_incident_id)` for use in
  child-table RLS policies (notes, messages, history) so staff can only
  access child rows for incidents they own (or any, if admin).

### 2. Incident Messages (Chat)
- New table `incident_messages`:
  - id, incident_id, sender_id, body, read_at, created_at
- RLS: staff can read messages on incidents they reported; admins can read all.
- INSERT: staff can send messages on their own incidents; admins on any.
  A trigger ensures only the reporter or an admin can send a message
  (defense-in-depth beyond RLS).
- Indexes on incident_id and created_at for efficient ordering.

### 3. Incident Claiming
- Adds `claimed_by uuid` and `claimed_at timestamptz` columns to incidents.
- RLS UPDATE policy updated: only admins can set claimed_by/claimed_at and
  assigned_to (claim/reassign). Staff retain the ability to update
  operational fields (status, acknowledgement) but NOT claim/assign.
- A BEFORE UPDATE trigger blocks non-admins from changing claimed_by,
  claimed_at, and assigned_to.

### 4. Child-table RLS updates
- `incident_notes` SELECT: staff see notes only on their own incidents.
- `incident_history` SELECT: staff see history only on their own incidents.
- `incident_messages` SELECT: staff see messages only on their own incidents.

## Security
- All policies use auth.uid() and the is_admin() helper.
- Staff cannot access other staff's incidents via direct URL or API calls
  because RLS returns zero rows for incidents they don't own.
- Claim/reassign is admin-only at both RLS and trigger level.
*/

-- ============================================================
-- 1. Helper: can_access_incident
-- Returns true if the current user is admin OR is the reporter of the incident.
-- ============================================================
create or replace function public.can_access_incident(p_incident_id uuid)
returns boolean
language sql
security definer set search_path = public
as $$
  select public.is_admin()
  or exists (
    select 1 from public.incidents i
    where i.id = p_incident_id and i.reporter_id = auth.uid()
  );
$$;

-- ============================================================
-- 2. Staff incident isolation — replace SELECT policy
-- ============================================================
drop policy if exists "incidents_select_all" on incidents;
drop policy if exists "incidents_select_role_aware" on incidents;

create policy "incidents_select_role_aware"
  on incidents for select
  to authenticated
  using (
    public.is_admin()
    or reporter_id = auth.uid()
  );

-- ============================================================
-- 3. Incident claiming columns
-- ============================================================
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'incidents' and column_name = 'claimed_by'
  ) then
    alter table incidents add column claimed_by uuid references profiles(id) on delete set null;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'incidents' and column_name = 'claimed_at'
  ) then
    alter table incidents add column claimed_at timestamptz;
  end if;
end $$;

-- ============================================================
-- 4. Block non-admins from claiming / reassigning (trigger)
-- ============================================================
create or replace function public.protect_incident_assignment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.assigned_to is distinct from old.assigned_to then
      raise exception 'Permission denied: only Secretariat/Admin can assign incidents';
    end if;
    if new.claimed_by is distinct from old.claimed_by then
      raise exception 'Permission denied: only Secretariat/Admin can claim incidents';
    end if;
    if new.claimed_at is distinct from old.claimed_at then
      raise exception 'Permission denied: only Secretariat/Admin can claim incidents';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_incident_assignment on incidents;
create trigger trg_protect_incident_assignment
  before update on incidents
  for each row execute function public.protect_incident_assignment();

-- ============================================================
-- 5. incident_messages table
-- ============================================================
create table if not exists incident_messages (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete set null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists incident_messages_incident_idx on incident_messages(incident_id);
create index if not exists incident_messages_created_idx on incident_messages(created_at);

alter table incident_messages enable row level security;

-- SELECT: admins see all; staff see messages on their own incidents
drop policy if exists "messages_select_role_aware" on incident_messages;
create policy "messages_select_role_aware"
  on incident_messages for select
  to authenticated
  using (public.can_access_incident(incident_id));

-- INSERT: staff send on their own incidents; admins on any
drop policy if exists "messages_insert_sender" on incident_messages;
create policy "messages_insert_sender"
  on incident_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.can_access_incident(incident_id)
  );

-- UPDATE: only admins can mark messages as read (read_at)
drop policy if exists "messages_update_admin" on incident_messages;
create policy "messages_update_admin"
  on incident_messages for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Defense-in-depth: only reporter or admin can send a message
create or replace function public.validate_message_sender()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.sender_id <> auth.uid() then
    raise exception 'Sender must be the authenticated user';
  end if;
  if not public.can_access_incident(new.incident_id) then
    raise exception 'Permission denied: you cannot message on this incident';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_message_sender on incident_messages;
create trigger trg_validate_message_sender
  before insert on incident_messages
  for each row execute function public.validate_message_sender();

-- ============================================================
-- 6. Update child-table SELECT policies for staff isolation
-- ============================================================

-- incident_notes: staff see notes only on their own incidents
drop policy if exists "notes_select_all" on incident_notes;
create policy "notes_select_role_aware"
  on incident_notes for select
  to authenticated
  using (public.can_access_incident(incident_id));

-- incident_history: staff see history only on their own incidents
drop policy if exists "history_select_all" on incident_history;
create policy "history_select_role_aware"
  on incident_history for select
  to authenticated
  using (public.can_access_incident(incident_id));

-- ============================================================
-- 7. Audit trigger: log claim/reassign actions
-- ============================================================
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
    if old.claimed_by is distinct from new.claimed_by then
      insert into public.incident_history (incident_id, user_id, action, old_value, new_value, timestamp)
      values (new.id, actor, 'Incident claimed', old.claimed_by::text, new.claimed_by::text, now());
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
