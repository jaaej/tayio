-- 0086: email copies of in-portal notifications.
--
-- Some notifications are also sent by email: urgent announcements to their
-- recipients, and tutor cover and leave alerts to admins. Each email is a copy
-- of one notification row, so the subject, text and link always match what the
-- recipient sees in their portal inbox. A row here is the delivery job for
-- that copy; the sender (src/lib/notification-email.ts) claims pending rows,
-- sends them through Resend, and records the outcome so retries from the cron
-- and the admin poller are safe and auditable.
--
-- Deleting the notification deletes its job, so an email that has not gone
-- out yet is never sent for a notification that no longer exists.
--
-- This replaces announcement_email_deliveries. That table is dropped by 0087
-- once the build that reads this one is live.
--
-- tutor_leave_requests.pending_reminders_sent counts the daily "still waiting
-- for a decision" reminders already sent for a pending leave request: the
-- n-th is due 24 * n hours after the request was made.
--
-- Apply BEFORE deploying the build that uses it (additive only).

create table if not exists public.email_deliveries (
  notification_id uuid primary key
    references public.notifications(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts between 0 and 10),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_deliveries_pending_idx
  on public.email_deliveries (status, attempts, updated_at);

-- Server-written and server-read only: no policies, so no client role can
-- read or change delivery state.
alter table public.email_deliveries enable row level security;

alter table public.tutor_leave_requests
  add column if not exists pending_reminders_sent integer not null default 0;
