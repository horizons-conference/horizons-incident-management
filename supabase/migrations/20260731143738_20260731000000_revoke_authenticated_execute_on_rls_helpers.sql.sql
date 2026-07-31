/*
# Revoke EXECUTE on RLS helper functions from authenticated

These three SECURITY DEFINER functions (is_admin, can_access_incident,
incident_structure_unchanged) are only invoked by RLS policies, which
evaluate with the table owner's privileges regardless of the caller's
EXECUTE grants. The app never calls them via .rpc(). Revoking EXECUTE
from authenticated closes the /rest/v1/rpc/... exposure while leaving
policy evaluation unaffected.
*/

revoke execute on function public.is_admin() from authenticated;
revoke execute on function public.can_access_incident(p_incident_id uuid) from authenticated;
revoke execute on function public.incident_structure_unchanged(
  p_id uuid, p_title text, p_type public.incident_type,
  p_location text, p_description text, p_priority public.incident_priority
) from authenticated;
