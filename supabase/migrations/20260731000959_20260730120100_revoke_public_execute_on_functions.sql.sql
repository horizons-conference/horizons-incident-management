/*
# Revoke EXECUTE from PUBLIC on all SECURITY DEFINER functions

PostgreSQL grants EXECUTE to PUBLIC by default, so the earlier
REVOKE FROM anon, authenticated had no effect. Revoke from PUBLIC,
then re-grant to authenticated only for the RLS helper functions
that policies evaluate for signed-in users. Trigger-only functions
need no grant at all (triggers fire regardless).
*/

-- Trigger-only functions: revoke from PUBLIC, no re-grant
revoke execute on function public.audit_incident() from public;
revoke execute on function public.audit_incident_note() from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.protect_incident_assignment() from public;
revoke execute on function public.protect_incident_structure() from public;
revoke execute on function public.protect_profile_role() from public;
revoke execute on function public.set_incident_number() from public;
revoke execute on function public.set_updated_at() from public;
revoke execute on function public.validate_message_sender() from public;

-- RLS helper functions: revoke from PUBLIC, re-grant to authenticated
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

revoke execute on function public.can_access_incident(p_incident_id uuid) from public;
grant execute on function public.can_access_incident(p_incident_id uuid) to authenticated;

revoke execute on function public.incident_structure_unchanged(
  p_id uuid, p_title text, p_type public.incident_type,
  p_location text, p_description text, p_priority public.incident_priority
) from public;
grant execute on function public.incident_structure_unchanged(
  p_id uuid, p_title text, p_type public.incident_type,
  p_location text, p_description text, p_priority public.incident_priority
) to authenticated;
