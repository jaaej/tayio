-- 0040_tutor_availability_subject.sql
-- Scopes a tutor's availability to the subject it applies to, so a tutor can
-- be free for Maths on Tuesday evening without that implying they are free to
-- take an English class in the same window.
--
-- Nullable on purpose: NULL means "any subject". Every existing row keeps its
-- current meaning (general availability) and every existing reader - the
-- reschedule suggester in src/lib/availability.ts, the tutor timetable - keeps
-- working unchanged because none of them filter on this column.
--
-- Additive nullable column plus an index; no policy change, so RLS is
-- untouched. Apply via scripts/apply-migration.mjs (never db:push).

ALTER TABLE tutor_availability
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS tutor_availability_tutor_subject_idx
  ON tutor_availability (tutor_id, subject_id);
