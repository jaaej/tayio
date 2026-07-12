-- Admin PIN brute-force lockout. Adds a failed-attempt counter and a lockout
-- timestamp to the singleton admin_settings row. Additive + idempotent + safe.
alter table public.admin_settings
  add column if not exists failed_attempts integer not null default 0,
  add column if not exists locked_until timestamptz;
