-- 0038_subject_week_objectives.sql
-- Adds a per-week learning-objectives field to the base curriculum. Admin-set
-- alongside the week Overview, shown to students, parents, and tutors as the
-- "By the end of this week you can" checklist (one objective per line).
--
-- Additive nullable text column; inherits the existing subject_weeks RLS - no
-- policy change. Apply via scripts/apply-migration.mjs (never db:push).

ALTER TABLE subject_weeks ADD COLUMN IF NOT EXISTS objectives text;
