-- 0064: subjects may share a name.
--
-- The owner wants two subjects both called "Mathematics" (say, one per year
-- level). Subjects are identified by id everywhere; the name is only a label,
-- shown with the year level where two could be confused.
--
-- Reversible while no two subjects share a name: add the constraint back.
-- Once duplicates exist, they must be renamed first.

begin;

alter table public.subjects
  drop constraint if exists subjects_name_unique;
-- The Postgres default name, in case a database was created with plain SQL.
alter table public.subjects
  drop constraint if exists subjects_name_key;

commit;
