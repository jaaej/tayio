-- 0061: discussion boards are readable only by people on that board.
--
-- 0012/0016 let every authenticated user read every thread, reply and
-- attachment (`using (true)`), so a withdrawn student, a parent, or a student
-- of another subject could read any subject board through the client SDK.
-- The app layer (canSeeBoard) now also excludes withdrawn enrolments; these
-- policies mirror it:
--   admin board (subject_id is null): students, tutors, admins
--   subject board: admins, tutors of a class in the subject, and students
--   with an active (not withdrawn) enrolment in a class of the subject.
-- Author insert/update and admin moderation policies are unchanged.

begin;

create or replace function public.can_read_discussion_subject(p_subject_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select
    public.is_admin()
    or (
      p_subject_id is null
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role::text <> 'parent'
      )
    )
    or exists (
      select 1 from public.classes c
      where c.subject_id = p_subject_id and c.tutor_id = auth.uid()
    )
    or exists (
      select 1
      from public.enrollments e
      join public.classes c on c.id = e.class_id
      where c.subject_id = p_subject_id
        and e.student_id = auth.uid()
        and e.withdrawn_at is null
    );
$$;

create or replace function public.subject_of_discussion_thread(p_thread_id uuid)
returns uuid language sql stable security definer set search_path = public, auth as $$
  select subject_id from public.discussion_threads where id = p_thread_id;
$$;

create or replace function public.subject_of_discussion_reply(p_reply_id uuid)
returns uuid language sql stable security definer set search_path = public, auth as $$
  select t.subject_id
  from public.discussion_replies r
  join public.discussion_threads t on t.id = r.thread_id
  where r.id = p_reply_id;
$$;

revoke all on function public.can_read_discussion_subject(uuid) from public, anon;
revoke all on function public.subject_of_discussion_thread(uuid) from public, anon;
revoke all on function public.subject_of_discussion_reply(uuid) from public, anon;
grant execute on function public.can_read_discussion_subject(uuid) to authenticated;
grant execute on function public.subject_of_discussion_thread(uuid) to authenticated;
grant execute on function public.subject_of_discussion_reply(uuid) to authenticated;

drop policy if exists discussion_threads_select_authenticated on public.discussion_threads;
create policy discussion_threads_select_board on public.discussion_threads
  for select to authenticated
  using (public.can_read_discussion_subject(subject_id));

drop policy if exists discussion_replies_select_authenticated on public.discussion_replies;
create policy discussion_replies_select_board on public.discussion_replies
  for select to authenticated
  using (public.can_read_discussion_subject(public.subject_of_discussion_thread(thread_id)));

drop policy if exists discussion_attachments_select_authenticated on public.discussion_attachments;
create policy discussion_attachments_select_board on public.discussion_attachments
  for select to authenticated
  using (
    public.can_read_discussion_subject(
      case
        when thread_id is not null then public.subject_of_discussion_thread(thread_id)
        else public.subject_of_discussion_reply(reply_id)
      end
    )
  );

commit;
