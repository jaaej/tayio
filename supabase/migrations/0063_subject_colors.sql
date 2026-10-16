-- 0063: admins pick each subject's colour.
--
-- Subject colours used to be guessed from the subject name. The key stored
-- here is one of the fixed palette in src/lib/subject-tone.ts; every role
-- reads it, so a subject looks the same everywhere. NULL keeps the colour
-- guessed from the name, so existing subjects do not change until an admin
-- picks one.

begin;

alter table public.subjects
  add column if not exists color text;

alter table public.subjects
  drop constraint if exists subjects_color_palette;
alter table public.subjects
  add constraint subjects_color_palette
  check (
    color is null
    or color in (
      'teal', 'violet', 'blue', 'pink', 'grey',
      'red', 'orange', 'amber', 'green', 'cyan'
    )
  );

commit;
