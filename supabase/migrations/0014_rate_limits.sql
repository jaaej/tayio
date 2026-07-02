-- 0014_rate_limits.sql
--
-- Backend rate limiting (checklist B3 / C4). A fixed-window counter table plus
-- an atomic increment-and-check function. Postgres-backed (not in-memory) so it
-- works across serverless instances and survives restarts.
--
-- Called server-side through Drizzle (postgres role, bypasses RLS). The table
-- has RLS enabled with NO policies so it's unreachable via the client SDK
-- (authenticated/anon get nothing); only the postgres/service_role connection
-- and the SECURITY DEFINER function touch it.
--
-- Idempotent: create table if not exists; create or replace function.

begin;

create table if not exists public.rate_limits (
  bucket text not null,
  identifier text not null,
  window_started_at timestamptz not null default now(),
  count integer not null default 0,
  primary key (bucket, identifier)
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Explicit deny-all for client roles. Privileges are already revoked above; this
-- makes the intent unmistakable and satisfies the RLS auditor (rls-on + >=1
-- policy). postgres / service_role bypass RLS, so the limiter still works.
drop policy if exists rate_limits_no_client_access on public.rate_limits;
create policy rate_limits_no_client_access on public.rate_limits
  for all to anon, authenticated using (false) with check (false);

-- Atomically bump the (bucket, identifier) counter within a rolling fixed
-- window and return whether the caller is still under p_max. The window resets
-- (count → 1, window_started_at → now) once it has elapsed. All SET expressions
-- see the pre-update row, so window_started_at and count stay consistent.
create or replace function public.check_rate_limit(
  p_bucket text,
  p_identifier text,
  p_max integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_count integer;
begin
  insert into public.rate_limits as rl (bucket, identifier, window_started_at, count)
  values (p_bucket, p_identifier, v_now, 1)
  on conflict (bucket, identifier) do update
    set
      window_started_at = case
        when rl.window_started_at < v_now - make_interval(secs => p_window_seconds)
          then v_now
        else rl.window_started_at
      end,
      count = case
        when rl.window_started_at < v_now - make_interval(secs => p_window_seconds)
          then 1
        else rl.count + 1
      end
  returning rl.count into v_count;

  return v_count <= p_max;
end;
$$;

comment on function public.check_rate_limit is
  'Atomic fixed-window rate limiter. Increments (bucket, identifier) and returns true while count <= p_max within p_window_seconds; resets the window once elapsed. Called server-side via the postgres role.';

-- Callable only by the owner (postgres role — used by Drizzle server-side).
-- Do NOT grant execute to authenticated/anon: the function INCREMENTS the
-- counter, so a logged-in user could call it with someone else's identifier
-- (e.g. bucket='login_email', a victim's email) to fill their bucket and lock
-- them out — broken access control / DoS. The app never calls it via a JWT.
revoke all on function public.check_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;

commit;
