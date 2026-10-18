-- 0067: a quiz's review note is kept apart from the admin's brief.
--
-- `quizzes.note` is the brief an admin writes when asking a tutor for a quiz.
-- Requesting changes used to overwrite it with the change request, so the
-- brief was lost after the first review (18 October 2026 consistency audit).
-- The latest change request now lives in `review_note`, dated by
-- `review_note_at`.
--
-- Existing data: a change request already written over a brief is found by
-- its "Changes requested" notification (its body is exactly the note) and
-- moved into review_note, so it no longer reads as the brief. The brief it
-- replaced was already gone. Development had none.
--
-- Both staff notes are withheld from the public API roles (the app reads
-- quizzes through its own server connection): students may read an approved
-- quiz row for their subject, and neither note is meant for them.
--
-- Reversible: drop the two columns and grant select on public.quizzes again.

begin;

alter table public.quizzes add column if not exists review_note text;
alter table public.quizzes add column if not exists review_note_at timestamptz;

update public.quizzes q
set review_note = q.note,
    review_note_at = n.created_at,
    note = null
from (
  select distinct on (href) href, body, created_at
  from public.notifications
  where title = 'Changes requested' and href like '/tutor/quizzes/%'
  order by href, created_at desc
) n
where n.href = '/tutor/quizzes/' || q.id::text
  and n.body = q.note
  and q.review_note is null;

-- Every other column stays readable. Listed from the catalogue because
-- databases differ in a few legacy quiz columns.
revoke select on public.quizzes from anon, authenticated;
do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
  into cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'quizzes'
    and column_name not in ('note', 'review_note');
  execute format('grant select (%s) on public.quizzes to authenticated', cols);
end $$;

commit;
