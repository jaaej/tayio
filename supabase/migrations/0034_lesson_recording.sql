-- Lesson recording link (link-based video for recorded lessons).
-- Tutors paste a hosted video URL (YouTube/Vimeo/Drive/etc.) onto a lesson;
-- students watch it from the "Recorded lessons" tab. Link-based, so there is
-- no storage bucket or egress cost. Additive, nullable column - the new column
-- inherits the existing row-level security policies on public.lessons, so no
-- policy changes are required.
alter table public.lessons
  add column if not exists recording_url text;
