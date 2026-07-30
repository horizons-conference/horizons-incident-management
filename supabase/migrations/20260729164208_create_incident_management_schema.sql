/*
# CAHSMUN Horizons 2026 — Incident Management System Schema

## Overview
Creates the full database schema for a conference incident management system used
by Secretariat members and conference staff. Authentication is required (Supabase
email/password auth), and role-based access control is enforced at the database level
via Row Level Security (RLS) policies.

## Tables created
1. `profiles` — one row per authenticated user, linked to auth.users. Holds display
   name, role (admin/staff), department, and active flag. Auto-created on signup via
   trigger.
2. `incidents` — the core incident records. Includes type, priority, title, location,
   description, reporter, assignee, status, acknowledgement tracking, and resolution
   tracking. Auto-generates a human-readable incident number (e.g. H26-0042).
3. `incident_notes` — chronological notes/timeline entries attached to an incident.
4. `incident_history` — immutable audit log of actions performed on an incident.

## Enums
- `user_role`: admin | staff
- `incident_priority`: critical | high | medium | low
- `incident_status`: open | in_progress | resolved
- `incident_type`: medical | safety | delegate | technical | venue | materials | security | other

## Security (RLS)
- All tables: authenticated users can read (staff directory and incidents are shared
  within the conference operations team).
- profiles: users update their own; admins can update/delete any.
- incidents: any authenticated staff can insert (as reporter) and update; only admins
  can delete.
- incident_notes: authenticated users insert with themselves as author.
- incident_history: authenticated users insert with themselves as actor; no update or
  delete policies (immutable audit trail).

## Triggers / functions
- `handle_new_user()` — creates a profile row when a new auth.users row is inserted.
- `set_incident_number()` — assigns H26-NNNN on insert.
- `set_updated_at()` — maintains updated_at on incidents.
*/

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type user_role as enum ('admin', 'staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type incident_priority as enum ('critical', 'high', 'medium', 'low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type incident_status as enum ('open', 'in_progress', 'resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type incident_type as enum ('medical', 'safety', 'delegate', 'technical', 'venue', 'materials', 'security', 'other');
exception when duplicate_object then null; end $$;

-- Sequence for incident numbers
create sequence if not exists incident_number_seq start 1;

-- profiles table
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role user_role not null default 'staff',
  department text,
  title text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "profiles_select_all" on profiles;
create policy "profiles_select_all" on profiles for select
  to authenticated using (true);

drop policy if exists "profiles_insert_self" on profiles;
create policy "profiles_insert_self" on profiles for insert
  to authenticated with check (id = auth.uid());

drop policy if exists "profiles_update_own_or_admin" on profiles;
create policy "profiles_update_own_or_admin" on profiles for update
  to authenticated
  using (id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "profiles_delete_admin" on profiles;
create policy "profiles_delete_admin" on profiles for delete
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- incidents table
create table if not exists incidents (
  id uuid primary key default gen_random_uuid(),
  incident_number text unique,
  type incident_type not null,
  priority incident_priority not null,
  title text not null,
  location text not null,
  description text not null,
  reporter_id uuid not null references profiles(id) on delete set null,
  assigned_to uuid references profiles(id) on delete set null,
  status incident_status not null default 'open',
  acknowledged boolean not null default false,
  acknowledged_by uuid references profiles(id) on delete set null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null
);

create index if not exists incidents_status_idx on incidents(status);
create index if not exists incidents_priority_idx on incidents(priority);
create index if not exists incidents_type_idx on incidents(type);
create index if not exists incidents_reporter_idx on incidents(reporter_id);
create index if not exists incidents_assigned_idx on incidents(assigned_to);
create index if not exists incidents_created_at_idx on incidents(created_at desc);

alter table incidents enable row level security;

drop policy if exists "incidents_select_all" on incidents;
create policy "incidents_select_all" on incidents for select
  to authenticated using (true);

drop policy if exists "incidents_insert_reporter" on incidents;
create policy "incidents_insert_reporter" on incidents for insert
  to authenticated with check (reporter_id = auth.uid());

drop policy if exists "incidents_update_staff" on incidents;
create policy "incidents_update_staff" on incidents for update
  to authenticated using (true) with check (true);

drop policy if exists "incidents_delete_admin" on incidents;
create policy "incidents_delete_admin" on incidents for delete
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- incident_notes table
create table if not exists incident_notes (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists incident_notes_incident_idx on incident_notes(incident_id);
create index if not exists incident_notes_created_idx on incident_notes(created_at);

alter table incident_notes enable row level security;

drop policy if exists "notes_select_all" on incident_notes;
create policy "notes_select_all" on incident_notes for select
  to authenticated using (true);

drop policy if exists "notes_insert_author" on incident_notes;
create policy "notes_insert_author" on incident_notes for insert
  to authenticated with check (author_id = auth.uid());

-- incident_history table (immutable audit log)
create table if not exists incident_history (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete set null,
  action text not null,
  old_value text,
  new_value text,
  timestamp timestamptz not null default now()
);

create index if not exists incident_history_incident_idx on incident_history(incident_id);
create index if not exists incident_history_timestamp_idx on incident_history(timestamp desc);

alter table incident_history enable row level security;

drop policy if exists "history_select_all" on incident_history;
create policy "history_select_all" on incident_history for select
  to authenticated using (true);

drop policy if exists "history_insert_actor" on incident_history;
create policy "history_insert_actor" on incident_history for insert
  to authenticated with check (user_id = auth.uid());

-- Functions
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role, department, title)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'staff'),
    new.raw_user_meta_data->>'department',
    new.raw_user_meta_data->>'title'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_incident_number()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.incident_number is null then
    new.incident_number := 'H26-' || lpad(nextval('incident_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_incident_number on incidents;
create trigger trg_incident_number
  before insert on incidents
  for each row execute function public.set_incident_number();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_incidents_updated_at on incidents;
create trigger trg_incidents_updated_at
  before update on incidents
  for each row execute function public.set_updated_at();
