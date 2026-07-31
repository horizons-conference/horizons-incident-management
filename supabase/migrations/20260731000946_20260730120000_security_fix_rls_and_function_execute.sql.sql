/*
# Security hardening: tighten UPDATE policy and lock down function EXECUTE

## 1. RLS Policy Always True fix
The `incidents_update_operational` policy had USING (true), letting any
authenticated user target ANY incident row for update (even though WITH
CHECK limited structural changes to admins). Narrow USING to match the
SELECT policy so staff can only update their own incidents and admins
can update any.

## 2. Revoke EXECUTE on trigger functions
Trigger functions (audit_incident, audit_incident_note, handle_new_user,
protect_incident_assignment, protect_incident_structure,
protect_profile_role, set_incident_number, set_updated_at,
validate_message_sender) are only invoked by triggers, not by clients.
Revoke EXECUTE from anon and authenticated so they cannot be called via
/rest/v1/rpc/... Triggers fire regardless of EXECUTE grants.

## 3. Revoke EXECUTE from anon on RLS helper functions
is_admin, can_access_incident, and incident_structure_unchanged are
called by RLS policies evaluated for authenticated users, so authenticated
retains EXECUTE. anon has no access to these tables, so revoke from anon.
*/

-- ============================================================
-- 1. Tighten incidents UPDATE policy
-- ============================================================
drop policy if exists "incidents_update_operational" on incidents;

create policy "incidents_update_operational"
  on incidents for update
  to authenticated
  using (
    public.is_admin() or reporter_id = auth.uid()
  )
  with check (
    public.is_admin()
    or public.incident_structure_unchanged(id, title, type, location, description, priority)
  );

-- ============================================================
-- 2. Revoke EXECUTE on trigger-only functions from anon and authenticated
-- ============================================================
revoke execute on function public.audit_incident() from anon, authenticated;
revoke execute on function public.audit_incident_note() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.protect_incident_assignment() from anon, authenticated;
revoke execute on function public.protect_incident_structure() from anon, authenticated;
revoke execute on function public.protect_profile_role() from anon, authenticated;
revoke execute on function public.set_incident_number() from anon, authenticated;
revoke execute on function public.set_updated_at() from anon, authenticated;
revoke execute on function public.validate_message_sender() from anon, authenticated;

-- ============================================================
-- 3. Revoke EXECUTE from anon on RLS helper functions (authenticated needs it)
-- ============================================================
revoke execute on function public.is_admin() from anon;
revoke execute on function public.can_access_incident(p_incident_id uuid) from anon;
revoke execute on function public.incident_structure_unchanged(
  p_id uuid, p_title text, p_type public.incident_type,
  p_location text, p_description text, p_priority public.incident_priority
) from anon;
