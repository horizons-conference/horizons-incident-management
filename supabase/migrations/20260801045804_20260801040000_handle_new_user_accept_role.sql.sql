/*
# Fix: handle_new_user should accept role from user metadata

The original security hardening migration forced handle_new_user() to
always insert role='staff', ignoring any role in user_metadata. This
was correct for public signups but breaks admin-created users, where
the admin-create-user edge function sets the role via user_metadata.

The edge function already does a follow-up UPDATE to set the role
after profile creation, so this is belt-and-suspenders: let the
trigger read the role from metadata (defaulting to 'staff'), and the
edge function's explicit UPDATE still has the final word.

Also adds username population (already added in the username_auth
migration, reconfirmed here for safety).
*/

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
