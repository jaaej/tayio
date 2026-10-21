-- 0082: a lesson Taiyo cancels, and a cover taught by someone not on the portal.
--
-- When no tutor takes a cover request, an admin either records that someone
-- outside the portal taught it, or cancels the lesson
-- (src/lib/lesson-cancel.ts): it is cancelled for everyone, families are told,
-- and each student it was for gets a class credit. Before this a cover nobody
-- took stayed on the timetable, on the absent tutor's weekly check-in and in
-- the attendance queue.
--
-- 1. tutor_cover_status 'external' and tutor_cover_requests.external_tutor_name:
--    covered by someone not on the portal (the name is optional). The lesson
--    stays the original tutor's, but leaves their check-in.
-- 2. lessons.cancelled_at / cancelled_by_id: when an admin cancelled it.
-- 3. credit_grant_reason 'lesson_cancelled': a credit because Taiyo cancelled.
--
-- A new enum value cannot be used in the transaction that adds it; this file
-- only alters schema. Additive. Reversible: drop the columns (enum values
-- cannot be dropped; harmless).

alter type public.tutor_cover_status add value if not exists 'external';
alter type public.credit_grant_reason add value if not exists 'lesson_cancelled';

alter table public.tutor_cover_requests
  add column if not exists external_tutor_name text;
alter table public.tutor_cover_requests
  drop constraint if exists tutor_cover_requests_external_name_check;
alter table public.tutor_cover_requests
  add constraint tutor_cover_requests_external_name_check
  check (external_tutor_name is null or char_length(external_tutor_name) <= 120);

alter table public.lessons
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by_id uuid references public.profiles(id) on delete set null;
