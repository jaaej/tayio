-- 0024_resources.sql — resource library table, RLS, audit
--
-- Implements the Resource Library data model (design spec 2026-07-23).
-- Adds two new enums, the resources table, subject-scoped RLS, two new
-- SECURITY DEFINER helper predicates, and an audit trigger.
--
-- Helper-name verification (grep supabase/migrations/ before writing):
--   Admin check  : public.is_admin()              ← migration 0004 (NOT is_admin_like)
--   Audit trigger: public.handle_audit_log()       ← migration 0006 (NOT record_audit)
--   teaches_subject, can_see_subject               ← NEW, defined here (none existed)
--
-- Reversible by:
--   DROP TABLE resources;
--   DROP TYPE resource_type;
--   DROP TYPE resource_kind;
--   DROP FUNCTION public.teaches_subject(uuid, uuid);
--   DROP FUNCTION public.can_see_subject(uuid, uuid);
--   (trigger is dropped automatically with the table)

begin;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Guarded like 0019/0022/0031/0032: CREATE TYPE has no IF NOT EXISTS, and on a
-- fresh bootstrap `drizzle-kit push` has already created these enums from
-- schema.ts before the migrations run.
do $$ begin
  if not exists (select 1 from pg_type where typname = 'resource_type') then
    create type resource_type as enum (
      'past_paper', 'worksheet', 'answer_sheet', 'notes',
      'formula_sheet', 'writing_template', 'exam_guide', 'video'
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'resource_kind') then
    create type resource_kind as enum ('file', 'link');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists resources (
  id                   uuid        primary key default gen_random_uuid(),
  subject_id           uuid        not null references subjects(id) on delete cascade,
  topic_id             uuid        references subject_topics(id) on delete set null,
  type                 resource_type not null,
  kind                 resource_kind not null,
  title                text        not null,
  description          text,
  -- file case: bucket + path are stored; reads mint short-lived signed URLs
  storage_bucket       text,
  storage_path         text,
  content_type         text,
  size_bytes           integer,
  -- link case: external URL validated by safe-url.ts at write time
  external_url         text,
  -- provenance + authorship
  uploaded_by          uuid        not null references profiles(id) on delete restrict,
  -- set when promoted from a tutor weekly attachment (no re-upload)
  source_attachment_id uuid        references tutor_week_attachments(id) on delete cascade,
  -- moderation fields
  is_published         boolean     not null default true,
  removed_at           timestamptz,
  removed_by           uuid        references profiles(id) on delete set null,
  removed_reason       text,
  created_at           timestamptz not null default now(),
  constraint resources_kind_payload check (
    (kind = 'file' and storage_path is not null) or
    (kind = 'link' and external_url is not null)
  )
);

create index if not exists resources_subject_published_idx on resources (subject_id, is_published);
create index if not exists resources_subject_type_idx      on resources (subject_id, type);
create index if not exists resources_topic_idx             on resources (topic_id);

-- ---------------------------------------------------------------------------
-- RLS
--
-- App layer (postgres / service-role) is the primary control — requireRole +
-- assertTeachesSubject on every server action. RLS is defense-in-depth (C6).
-- ---------------------------------------------------------------------------

alter table resources enable row level security;

-- Helper: does p_uid teach a class for p_subject_id?
-- SECURITY DEFINER + pinned search_path; returns bool only (no data leak).
create or replace function public.teaches_subject(p_uid uuid, p_subject_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.classes c
    where c.subject_id = p_subject_id
      and c.tutor_id = p_uid
  );
$$;

-- Helper: is p_uid a student enrolled in a class for p_subject_id,
-- or a parent of such a student?
-- SECURITY DEFINER + pinned search_path; returns bool only.
create or replace function public.can_see_subject(p_uid uuid, p_subject_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select
    -- student actively enrolled in a class for this subject
    exists (
      select 1
      from public.enrollments e
      join public.classes c on c.id = e.class_id
      where c.subject_id = p_subject_id
        and e.student_id = p_uid
        and e.withdrawn_at is null
    )
    -- parent of a student actively enrolled in a class for this subject
    or exists (
      select 1
      from public.enrollments e
      join public.classes c on c.id = e.class_id
      join public.family_links fl on fl.student_id = e.student_id
      where c.subject_id = p_subject_id
        and fl.parent_id = p_uid
        and e.withdrawn_at is null
    );
$$;

-- Students and parents: read only published, non-removed rows for subjects
-- they have access to. Tutors and admins are covered by the write policy below
-- (FOR ALL policies also govern SELECT; the two policies OR together).
drop policy if exists resources_read_scoped on resources;
create policy resources_read_scoped on resources
  for select to authenticated
  using (
    is_published
    and removed_at is null
    and (
      public.is_admin()
      or public.teaches_subject(auth.uid(), subject_id)
      or public.can_see_subject(auth.uid(), subject_id)
    )
  );

-- Tutors (for subjects they teach) and admins: full read + write.
-- The USING clause applies to SELECT as well, so tutors/admins can read
-- unpublished resources for their subjects (the student read policy is additive).
drop policy if exists resources_write_tutor_admin on resources;
create policy resources_write_tutor_admin on resources
  for all to authenticated
  using (
    public.is_admin()
    or public.teaches_subject(auth.uid(), subject_id)
  )
  with check (
    public.is_admin()
    or public.teaches_subject(auth.uid(), subject_id)
  );

-- ---------------------------------------------------------------------------
-- Audit trigger — reuses handle_audit_log() from migration 0006
-- ---------------------------------------------------------------------------

drop trigger if exists resources_audit on resources;
create trigger resources_audit
  after insert or update or delete on resources
  for each row execute function public.handle_audit_log();

commit;
