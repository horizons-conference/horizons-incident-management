/*
# Fix: allow incidents.reporter_id to be NULL

The FK incidents_reporter_id_fkey is ON DELETE SET NULL, but the column
was NOT NULL. Deleting any user who reported an incident caused Postgres
to attempt SET NULL, violate the constraint, and abort the entire
deletion (surfacing as "Database error deleting user").

Making the column nullable lets the cascade complete: the incident
record is preserved with an unknown/anonymous reporter.
*/

alter table public.incidents alter column reporter_id drop not null;
