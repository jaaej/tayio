-- 0044_notification_dedupe.sql - retry-safe scheduled notifications.
-- Additive and non-destructive. Ordinary notifications retain a NULL key;
-- Postgres permits multiple NULL values in the unique index.
--
-- Reversible by:
--   DROP INDEX public.notifications_user_dedupe_idx;
--   ALTER TABLE public.notifications DROP COLUMN dedupe_key;

begin;

alter table public.notifications
  add column if not exists dedupe_key text;

create unique index if not exists notifications_user_dedupe_idx
  on public.notifications(user_id, dedupe_key);

commit;
