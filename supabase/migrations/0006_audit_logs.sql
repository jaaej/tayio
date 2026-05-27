-- 0006_audit_logs.sql
--
-- Append-only audit trail for changes to admin-managed tables. Required by
-- Admin PRD §14 ("audit logs for admin actions"). Implements security
-- checklist items G1 + G3.
--
-- Tables under audit:
--   profiles, family_links, classes, enrollments, invoices, announcements
--
-- Why this list: these are the high-stakes operational tables that an admin
-- mutates and that a regulator / customer / forensic investigator might ask
-- "who changed this, and when?" about. Tutor-driven high-volume tables
-- (homework, lesson_notes, attendance, progress_topics) are deliberately
-- excluded — auditing every attendance mark would balloon the log without
-- adding security value.
--
-- Architecture:
--   - One `audit_logs` table (created here, also declared in src/db/schema.ts
--     for Drizzle awareness — kept in sync manually).
--   - One trigger function `public.handle_audit_log()`, SECURITY DEFINER,
--     captures auth.uid() + JWT role + old/new row state as JSONB.
--   - One AFTER INSERT/UPDATE/DELETE trigger per watched table.
--   - The function fires regardless of actor role. Server-context operations
--     (e.g. Drizzle queries via the postgres role) produce a row with
--     actor_id = NULL and actor_role = NULL — "system / server" actor.
--     This is intentional: a NULL actor is a signal that the change came
--     from server code, not a logged-in user. We'd rather log everything
--     and filter later than silently miss changes.
--
-- Tamper resistance:
--   - RLS allows SELECT only to admins (via public.is_admin()).
--   - No INSERT / UPDATE / DELETE policy is granted to any role — the trigger
--     bypasses RLS because it runs SECURITY DEFINER (owner = postgres).
--   - Anyone trying to write to audit_logs via the client SDK or via the
--     postgres role through Drizzle bypasses RLS too, so the immutability
--     promise here is "the application cannot tamper" — not "no role can
--     ever write." A full immutability story would require a separate
--     postgres role with bypassrls revoked and used by the runtime.
--
-- Idempotent: create or replace function; drop trigger if exists; drop
-- policy if exists. Safe to re-run.

begin;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  action text not null,
  table_name text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx
  on public.audit_logs (actor_id);
create index if not exists audit_logs_table_idx
  on public.audit_logs (table_name);

-- ---------------------------------------------------------------------------
-- Trigger function
-- ---------------------------------------------------------------------------

create or replace function public.handle_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    table_name,
    old_data,
    new_data
  ) values (
    auth.uid(),
    auth.jwt() -> 'app_metadata' ->> 'role',
    tg_op,
    tg_table_name,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  -- AFTER triggers ignore the return value; coalesce is for safety.
  return coalesce(new, old);
end;
$$;

comment on function public.handle_audit_log is
  'Writes a row to public.audit_logs for every INSERT/UPDATE/DELETE on tables it is attached to. Captures actor_id (auth.uid()) and actor_role (JWT app_metadata.role) if available; null if the change came from a server-context query.';

-- ---------------------------------------------------------------------------
-- Triggers — one per watched table
-- ---------------------------------------------------------------------------

drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.handle_audit_log();

drop trigger if exists audit_family_links on public.family_links;
create trigger audit_family_links
  after insert or update or delete on public.family_links
  for each row execute function public.handle_audit_log();

drop trigger if exists audit_classes on public.classes;
create trigger audit_classes
  after insert or update or delete on public.classes
  for each row execute function public.handle_audit_log();

drop trigger if exists audit_enrollments on public.enrollments;
create trigger audit_enrollments
  after insert or update or delete on public.enrollments
  for each row execute function public.handle_audit_log();

drop trigger if exists audit_invoices on public.invoices;
create trigger audit_invoices
  after insert or update or delete on public.invoices
  for each row execute function public.handle_audit_log();

drop trigger if exists audit_announcements on public.announcements;
create trigger audit_announcements
  after insert or update or delete on public.announcements
  for each row execute function public.handle_audit_log();

-- ---------------------------------------------------------------------------
-- RLS — admins read, no one writes (trigger handles writes via SECURITY DEFINER)
-- ---------------------------------------------------------------------------

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_admin_read on public.audit_logs;

create policy audit_logs_admin_read on public.audit_logs
  for select to authenticated
  using (public.is_admin());

-- Tighten default grants: authenticated role gets SELECT only; everything else
-- denied. service_role and postgres still bypass RLS (and bypassrls) so seed
-- scripts and migration tools work.
revoke all on public.audit_logs from public;
revoke all on public.audit_logs from anon;
revoke all on public.audit_logs from authenticated;
grant select on public.audit_logs to authenticated;

commit;
