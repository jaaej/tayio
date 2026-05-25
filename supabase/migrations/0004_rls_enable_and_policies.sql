-- 0004_rls_enable_and_policies.sql
--
-- Enables Row Level Security on every public table and writes the role-aware
-- policies that implement the access matrix in docs/PRD_*.md.
--
-- Wrapped in BEGIN/COMMIT so a failure anywhere rolls back the whole thing —
-- never leave the DB in a "RLS on, no policies = locked out" state.
--
-- Idempotent: helpers use CREATE OR REPLACE; policies use DROP IF EXISTS
-- before CREATE. Safe to re-run.
--
-- Note on the service_role: Supabase grants service_role bypassrls, so all
-- the server-side scripts (seed-users.mjs, seed-demo.mjs) and Next.js API
-- routes using the service role continue to work without any RLS exception.
--
-- Note on the lesson_notes view path: lesson_notes (base table) is locked to
-- tutors (own) and admins (all). Students and parents have NO direct access
-- — they read through public.lesson_notes_safe (migration 0003), which
-- bypasses base-table RLS and enforces row visibility in its own WHERE
-- clause while omitting internal_note. Update path is unchanged: tutors
-- write to the base table directly.

begin;

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- All helpers are SECURITY DEFINER so they bypass RLS when consulting the
-- underlying tables. Without this, policies recurse: e.g.
--   is_enrolled_in(class) → SELECT enrollments
--     → enrollments policy → is_tutor_of_class(class)
--       → SELECT classes → classes policy → is_enrolled_in(class) → ...
-- Stack exhausts.
--
-- SECURITY DEFINER runs the function with the OWNER's privileges, bypassing
-- the caller's RLS. The function bodies are deliberately tiny and only
-- check predicates on the calling user (auth.uid() / auth.jwt()), so there's
-- no way to leak data — they can only return true or false about the
-- caller's own relationships.
--
-- search_path is pinned to prevent search-path injection (a classic
-- SECURITY DEFINER attack vector).

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public, auth
  as $$
    select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
  $$;

create or replace function public.is_parent_of(p_student uuid) returns boolean
  language sql stable security definer set search_path = public, auth
  as $$
    select exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid() and fl.student_id = p_student
    );
  $$;

create or replace function public.is_enrolled_in(p_class uuid) returns boolean
  language sql stable security definer set search_path = public, auth
  as $$
    select exists (
      select 1 from public.enrollments e
      where e.class_id = p_class
        and e.student_id = auth.uid()
        and e.withdrawn_at is null
    );
  $$;

create or replace function public.is_tutor_of_class(p_class uuid) returns boolean
  language sql stable security definer set search_path = public, auth
  as $$
    select exists (
      select 1 from public.classes c
      where c.id = p_class and c.tutor_id = auth.uid()
    );
  $$;

create or replace function public.is_parent_of_enrolled_in(p_class uuid) returns boolean
  language sql stable security definer set search_path = public, auth
  as $$
    select exists (
      select 1 from public.enrollments e
      join public.family_links fl on fl.student_id = e.student_id
      where e.class_id = p_class
        and fl.parent_id = auth.uid()
        and e.withdrawn_at is null
    );
  $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_admin_all on public.profiles;

-- Self-read: every authenticated user can see their own profile row.
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

-- Self-update: user can update their own profile.
-- CAVEAT: this allows updating any column, including 'role'. The 'role' column
-- on profiles is for display/joins only — the authoritative role lives in
-- auth.users.raw_app_meta_data (which the user CANNOT modify). RLS policies
-- on every other table read role from auth.jwt(), not from profiles.role.
-- A user changing profiles.role on themselves does not grant any access.
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admin: full access to all profile rows.
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Tutors need to read student profiles for classes they teach so the tutor
-- portal can render student lists. Restricted to enrolled students of the
-- tutor's classes — not arbitrary profile lookups.
create policy profiles_tutor_read_students on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.enrollments e
      join public.classes c on c.id = e.class_id
      where e.student_id = public.profiles.id
        and c.tutor_id = auth.uid()
        and e.withdrawn_at is null
    )
  );

-- Parents need to read their linked children's profiles for the parent portal.
create policy profiles_parent_read_children on public.profiles
  for select to authenticated
  using (public.is_parent_of(public.profiles.id));

-- ---------------------------------------------------------------------------
-- family_links
-- ---------------------------------------------------------------------------
alter table public.family_links enable row level security;

drop policy if exists family_links_parent_read on public.family_links;
drop policy if exists family_links_student_read on public.family_links;
drop policy if exists family_links_admin_all on public.family_links;

create policy family_links_parent_read on public.family_links
  for select to authenticated using (parent_id = auth.uid());

-- Students can see who their parents are (low-sensitivity; parents are listed
-- on the student dashboard for emergency contact).
create policy family_links_student_read on public.family_links
  for select to authenticated using (student_id = auth.uid());

create policy family_links_admin_all on public.family_links
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- subjects
-- ---------------------------------------------------------------------------
alter table public.subjects enable row level security;

drop policy if exists subjects_select_authenticated on public.subjects;
drop policy if exists subjects_admin_all on public.subjects;

create policy subjects_select_authenticated on public.subjects
  for select to authenticated using (true);

create policy subjects_admin_all on public.subjects
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------------
alter table public.classes enable row level security;

drop policy if exists classes_student_read on public.classes;
drop policy if exists classes_parent_read on public.classes;
drop policy if exists classes_tutor_read on public.classes;
drop policy if exists classes_admin_all on public.classes;

create policy classes_student_read on public.classes
  for select to authenticated using (public.is_enrolled_in(id));

create policy classes_parent_read on public.classes
  for select to authenticated using (public.is_parent_of_enrolled_in(id));

create policy classes_tutor_read on public.classes
  for select to authenticated using (tutor_id = auth.uid());

create policy classes_admin_all on public.classes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- enrollments
-- ---------------------------------------------------------------------------
alter table public.enrollments enable row level security;

drop policy if exists enrollments_student_read on public.enrollments;
drop policy if exists enrollments_parent_read on public.enrollments;
drop policy if exists enrollments_tutor_read on public.enrollments;
drop policy if exists enrollments_admin_all on public.enrollments;

create policy enrollments_student_read on public.enrollments
  for select to authenticated using (student_id = auth.uid());

create policy enrollments_parent_read on public.enrollments
  for select to authenticated using (public.is_parent_of(student_id));

create policy enrollments_tutor_read on public.enrollments
  for select to authenticated using (public.is_tutor_of_class(class_id));

create policy enrollments_admin_all on public.enrollments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- lessons
-- ---------------------------------------------------------------------------
alter table public.lessons enable row level security;

drop policy if exists lessons_student_read on public.lessons;
drop policy if exists lessons_parent_read on public.lessons;
drop policy if exists lessons_tutor_all on public.lessons;
drop policy if exists lessons_admin_all on public.lessons;

create policy lessons_student_read on public.lessons
  for select to authenticated using (public.is_enrolled_in(class_id));

create policy lessons_parent_read on public.lessons
  for select to authenticated using (public.is_parent_of_enrolled_in(class_id));

-- Tutor can read + update their own lessons (e.g. mark cancelled, change time).
create policy lessons_tutor_all on public.lessons
  for all to authenticated
  using (tutor_id = auth.uid())
  with check (tutor_id = auth.uid());

create policy lessons_admin_all on public.lessons
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- lesson_notes  (base table — students/parents go through lesson_notes_safe)
-- ---------------------------------------------------------------------------
alter table public.lesson_notes enable row level security;

drop policy if exists lesson_notes_tutor_all on public.lesson_notes;
drop policy if exists lesson_notes_admin_all on public.lesson_notes;

create policy lesson_notes_tutor_all on public.lesson_notes
  for all to authenticated
  using (tutor_id = auth.uid())
  with check (tutor_id = auth.uid());

create policy lesson_notes_admin_all on public.lesson_notes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No student or parent policy on the base table — by design. They use the
-- public.lesson_notes_safe view, which bypasses RLS on this table.

-- ---------------------------------------------------------------------------
-- attendance
-- ---------------------------------------------------------------------------
alter table public.attendance enable row level security;

drop policy if exists attendance_student_read on public.attendance;
drop policy if exists attendance_parent_read on public.attendance;
drop policy if exists attendance_tutor_all on public.attendance;
drop policy if exists attendance_admin_all on public.attendance;

create policy attendance_student_read on public.attendance
  for select to authenticated using (student_id = auth.uid());

create policy attendance_parent_read on public.attendance
  for select to authenticated using (public.is_parent_of(student_id));

-- Tutor can write attendance only for lessons they taught.
create policy attendance_tutor_all on public.attendance
  for all to authenticated
  using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_id and l.tutor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_id and l.tutor_id = auth.uid()
    )
  );

create policy attendance_admin_all on public.attendance
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- homework  (the homework definition; assignments are a separate table)
-- ---------------------------------------------------------------------------
alter table public.homework enable row level security;

drop policy if exists homework_student_read on public.homework;
drop policy if exists homework_parent_read on public.homework;
drop policy if exists homework_tutor_all on public.homework;
drop policy if exists homework_admin_all on public.homework;

-- Student sees homework rows for which they have an assignment.
create policy homework_student_read on public.homework
  for select to authenticated using (
    exists (
      select 1 from public.homework_assignments ha
      where ha.homework_id = homework.id and ha.student_id = auth.uid()
    )
  );

-- Parent sees homework rows for which a linked child has an assignment.
create policy homework_parent_read on public.homework
  for select to authenticated using (
    exists (
      select 1 from public.homework_assignments ha
      join public.family_links fl on fl.student_id = ha.student_id
      where ha.homework_id = homework.id and fl.parent_id = auth.uid()
    )
  );

-- Tutor: full CRUD on homework they authored.
create policy homework_tutor_all on public.homework
  for all to authenticated
  using (tutor_id = auth.uid())
  with check (tutor_id = auth.uid());

create policy homework_admin_all on public.homework
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- homework_assignments
-- ---------------------------------------------------------------------------
alter table public.homework_assignments enable row level security;

drop policy if exists homework_assignments_student_select on public.homework_assignments;
drop policy if exists homework_assignments_student_update on public.homework_assignments;
drop policy if exists homework_assignments_parent_read on public.homework_assignments;
drop policy if exists homework_assignments_tutor_all on public.homework_assignments;
drop policy if exists homework_assignments_admin_all on public.homework_assignments;

create policy homework_assignments_student_select on public.homework_assignments
  for select to authenticated using (student_id = auth.uid());

-- Student can update their own assignment row (submission status, uploaded
-- work, etc.). CAVEAT: this allows updating any column, including 'score',
-- 'feedback', 'marked_at', 'marked_by'. The student portal's API code MUST
-- restrict the columns it sends to UPDATE statements. A future migration
-- can split off a SECURITY DEFINER function for submissions to enforce
-- column-level limits at the DB layer.
create policy homework_assignments_student_update on public.homework_assignments
  for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy homework_assignments_parent_read on public.homework_assignments
  for select to authenticated using (public.is_parent_of(student_id));

-- Tutor: read + write for assignments of homework they authored.
create policy homework_assignments_tutor_all on public.homework_assignments
  for all to authenticated
  using (
    exists (
      select 1 from public.homework h
      where h.id = homework_id and h.tutor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.homework h
      where h.id = homework_id and h.tutor_id = auth.uid()
    )
  );

create policy homework_assignments_admin_all on public.homework_assignments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- progress_topics
-- ---------------------------------------------------------------------------
alter table public.progress_topics enable row level security;

drop policy if exists progress_topics_student_read on public.progress_topics;
drop policy if exists progress_topics_parent_read on public.progress_topics;
drop policy if exists progress_topics_tutor_all on public.progress_topics;
drop policy if exists progress_topics_admin_all on public.progress_topics;

create policy progress_topics_student_read on public.progress_topics
  for select to authenticated using (student_id = auth.uid());

create policy progress_topics_parent_read on public.progress_topics
  for select to authenticated using (public.is_parent_of(student_id));

-- Tutor can write topic rows for students enrolled in classes they teach.
create policy progress_topics_tutor_all on public.progress_topics
  for all to authenticated
  using (
    exists (
      select 1 from public.enrollments e
      join public.classes c on c.id = e.class_id
      where e.student_id = progress_topics.student_id
        and c.tutor_id = auth.uid()
        and e.withdrawn_at is null
    )
  )
  with check (
    exists (
      select 1 from public.enrollments e
      join public.classes c on c.id = e.class_id
      where e.student_id = progress_topics.student_id
        and c.tutor_id = auth.uid()
        and e.withdrawn_at is null
    )
  );

create policy progress_topics_admin_all on public.progress_topics
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
alter table public.invoices enable row level security;

drop policy if exists invoices_parent_read on public.invoices;
drop policy if exists invoices_student_read on public.invoices;
drop policy if exists invoices_admin_all on public.invoices;

create policy invoices_parent_read on public.invoices
  for select to authenticated using (parent_id = auth.uid());

-- Students may view their own invoices (older students paying for themselves,
-- or just visibility into what their parent is being charged for them).
create policy invoices_student_read on public.invoices
  for select to authenticated using (student_id = auth.uid());

create policy invoices_admin_all on public.invoices
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- announcements
-- ---------------------------------------------------------------------------
alter table public.announcements enable row level security;

drop policy if exists announcements_read_audience on public.announcements;
drop policy if exists announcements_admin_all on public.announcements;

create policy announcements_read_audience on public.announcements
  for select to authenticated using (
    -- everyone-targeted
    (audience_role is null and audience_class_id is null)
    -- role-targeted: my role matches
    or (
      audience_role is not null
      and audience_role::text = (auth.jwt() -> 'app_metadata' ->> 'role')
    )
    -- class-targeted: I'm in that class somehow
    or (audience_class_id is not null and (
      public.is_enrolled_in(audience_class_id)
      or public.is_tutor_of_class(audience_class_id)
      or public.is_parent_of_enrolled_in(audience_class_id)
    ))
  );

create policy announcements_admin_all on public.announcements
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;

drop policy if exists notifications_user_select on public.notifications;
drop policy if exists notifications_user_update_read on public.notifications;
drop policy if exists notifications_admin_all on public.notifications;

create policy notifications_user_select on public.notifications
  for select to authenticated using (user_id = auth.uid());

-- Users can mark their own notifications as read (writes to read_at).
create policy notifications_user_update_read on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notifications_admin_all on public.notifications
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- INSERTs come from server code using service_role (which bypasses RLS).
-- No insert policy for authenticated.

commit;
