-- Admin PIN wall (step-up auth). Singleton settings table holding a scrypt
-- hash of the admin PIN. Enforced as a single row in app logic (read limit 1,
-- upsert the existing row). RLS on, no client policies: all access is
-- server-side Drizzle as postgres, which bypasses RLS. Deny-by-default for
-- anon/authenticated. Additive + safe.
create table if not exists public.admin_settings (
  id uuid primary key default gen_random_uuid(),
  pin_hash text,
  updated_at timestamptz not null default now()
);

alter table public.admin_settings enable row level security;
