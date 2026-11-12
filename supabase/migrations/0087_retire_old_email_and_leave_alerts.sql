-- 0087: retire what 0086 replaced.
--
-- announcement_email_deliveries was the urgent-announcement email queue;
-- email_deliveries (0086) now carries every notification email. Production
-- had no rows in it when this was written (6 November 2026): no urgent
-- announcement had been published there.
--
-- tutor_leave_requests.last_uncovered_reminder_on drove the daily "extended
-- leave is still not fully covered" alert. Classes from approved leave now
-- raise the same 48-hour and 24-hour cover alerts as any other class, so the
-- leave-level alert and its column are gone.
--
-- Apply AFTER the build that no longer reads or writes them is live: the
-- previous build writes both.

drop table if exists public.announcement_email_deliveries;

alter table public.tutor_leave_requests
  drop column if exists last_uncovered_reminder_on;
