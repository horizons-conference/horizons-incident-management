/*
# Fix: restore EXECUTE on RLS helper functions for authenticated

A prior migration revoked EXECUTE on is_admin(), can_access_incident(),
and incident_structure_unchanged() from authenticated, believing RLS
policies evaluate with the table owner's privileges. They do not —
RLS policies evaluate with the querying user's privileges, so the
caller needs EXECUTE on any function referenced in a policy.

Without EXECUTE, INSERT ... RETURNING on incidents fails because the
RETURNING rows are filtered by the SELECT policy (incidents_select_role_aware),
which calls is_admin(). The function call raises "permission denied",
zero rows are returned, and .single() throws — surfacing as
"Failed to report incident".

Re-grant EXECUTE to authenticated on all three helper functions.
*/

grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_access_incident(p_incident_id uuid) to authenticated;
grant execute on function public.incident_structure_unchanged(
  p_id uuid, p_title text, p_type public.incident_type,
  p_location text, p_description text, p_priority public.incident_priority
) to authenticated;
