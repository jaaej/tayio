-- 0057_subject_homework_drafts.sql
-- Admins can prepare homework against a curriculum week before a class and
-- marking tutor exist. Class-assigned homework continues to require its tutor.

begin;

alter table public.homework
  alter column tutor_id drop not null;

commit;
