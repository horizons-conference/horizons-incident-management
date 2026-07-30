/*
# Create incident_categories table

## Overview
Adds a configurable table for incident categories/types so administrators
can manage labels and active status without editing code. The `key`
column mirrors the existing `incident_type` enum values so the
`incidents.type` column stays compatible.

## New Table
- `incident_categories`
  - `id` (uuid PK)
  - `key` (text, unique) — matches an incident_type enum value
  - `label` (text) — display label
  - `icon` (text) — emoji icon
  - `active` (boolean, default true)
  - `sort_order` (int, default 0)
  - `created_at` (timestamptz)

## Security
- RLS enabled.
- All authenticated users can SELECT (needed to render dropdowns).
- Only admins can INSERT/UPDATE/DELETE.

## Seed data
- Inserts the 8 default categories matching the enum.
*/

create table if not exists public.incident_categories (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  icon text not null default '📢',
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.incident_categories enable row level security;

drop policy if exists "categories_select_all" on incident_categories;
create policy "categories_select_all"
  on incident_categories for select
  to authenticated using (true);

drop policy if exists "categories_insert_admin" on incident_categories;
create policy "categories_insert_admin"
  on incident_categories for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "categories_update_admin" on incident_categories;
create policy "categories_update_admin"
  on incident_categories for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "categories_delete_admin" on incident_categories;
create policy "categories_delete_admin"
  on incident_categories for delete
  to authenticated
  using (public.is_admin());

-- Seed default categories (idempotent)
insert into public.incident_categories (key, label, icon, sort_order) values
  ('medical', 'Medical', '🏥', 1),
  ('safety', 'Safety', '🚨', 2),
  ('delegate', 'Delegate', '👤', 3),
  ('technical', 'Technical / AV', '🖥️', 4),
  ('venue', 'Venue', '🏨', 5),
  ('materials', 'Materials', '📦', 6),
  ('security', 'Security / Access', '🔑', 7),
  ('other', 'Other', '📢', 8)
on conflict (key) do nothing;
