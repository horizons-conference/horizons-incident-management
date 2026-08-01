/*
# Switch authentication from email to username

## Overview
This migration transitions the app from email-based authentication to
username-based authentication. Supabase Auth still requires an email
field on `auth.users`, so we use a synthetic email (`username@app.local`)
internally while exposing only the username to users.

## Changes
1. `profiles` table
   - Add `username` column (text, unique, not null) — the user-facing login identity.
   - Make `email` nullable (it's no longer user-facing; kept for backward compat).
   - Add a unique index on `username`.
   - Backfill `username` from the existing email local-part for current users.
2. `handle_new_user()` trigger
   - Updated to populate `username` from `raw_user_meta_data->>'username'`,
     falling back to the email local-part when absent.
   - `email` is set from `raw_user_meta_data->>'email'` when provided,
     otherwise from the synthetic auth email.
3. RLS policies
   - No policy changes — username is readable alongside other profile fields
     under the existing `profiles_select_all` policy.

## Important notes
- The frontend will send `username` in `user_metadata` when creating users.
- The `admin-create-user` edge function constructs a synthetic email
  `<username>@app.local` so Supabase Auth accepts the request.
- Existing users are backfilled a username derived from their email prefix.
*/

-- 1. Add username column to profiles
alter table public.profiles add column if not exists username text;

-- 2. Backfill username from email local-part for existing rows
update public.profiles
set username = split_part(email, '@', 1)
where username is null;

-- 3. Enforce NOT NULL + UNIQUE after backfill
alter table public.profiles alter column username set not null;

drop index if exists public.profiles_username_idx;
create unique index if not exists profiles_username_idx on public.profiles (username);

-- 4. Make email nullable (no longer required for username-based auth)
alter table public.profiles alter column email drop not null;

-- 5. Update handle_new_user trigger to populate username
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role, department, title, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'email', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'staff'),
    new.raw_user_meta_data->>'department',
    new.raw_user_meta_data->>'title',
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
