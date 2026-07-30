/*
# Fix profile deletion: make actor FK columns nullable

The incident_history.user_id, incident_messages.sender_id, and
incident_notes.author_id columns were declared NOT NULL but their
foreign keys use ON DELETE SET NULL. This contradiction caused every
profile deletion to fail with a constraint violation, because Postgres
could not set a NOT NULL column to NULL on cascade.

Making these columns nullable lets ON DELETE SET NULL succeed, which
preserves the historical/audit rows while removing the user reference.
*/

alter table public.incident_history
  alter column user_id drop not null;

alter table public.incident_messages
  alter column sender_id drop not null;

alter table public.incident_notes
  alter column author_id drop not null;
