-- 0017_role_tiers_add_values.sql
--
-- Adds the four tiered role values to the user_role enum. Kept in a SEPARATE
-- migration from the row migration (0018) because Postgres does not allow a
-- newly-added enum value to be USED in the same transaction that adds it.
--
-- The four original values (student/parent/tutor/admin) are intentionally
-- retained: after 0018 every account carries a tiered value, but the coarse
-- values still serve as announcement audience targets and DM/discussion
-- display prefixes. See src/lib/roles.ts.
--
-- Raw SQL by design — do NOT use drizzle-kit push (it disables RLS and drops
-- every policy + the lesson_notes_safe view). Apply with the dev server stopped.

alter type public.user_role add value if not exists 'admin_unrestricted';
alter type public.user_role add value if not exists 'admin_restricted';
alter type public.user_role add value if not exists 'student_unrestricted';
alter type public.user_role add value if not exists 'student_restricted';
