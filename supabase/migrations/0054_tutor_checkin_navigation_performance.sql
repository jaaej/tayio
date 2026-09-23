-- 0054_tutor_checkin_navigation_performance.sql
-- Supports weekly tutor/payroll reconciliation without scanning every lesson.

begin;

create index if not exists lessons_tutor_date_status_idx
  on public.lessons (tutor_id, date, status);

commit;
