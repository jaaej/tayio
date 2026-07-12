-- 0022 — math game scores (student "Math Sprint" speed-drill leaderboard)
--
-- Append-only: one row per completed 60s run. Leaderboard = max(score) per
-- student per difficulty. App reads/writes via Drizzle as the postgres role
-- (bypasses RLS); RLS enabled with no policies = deny-by-default for
-- anon/authenticated, matching the existing model.
--
-- Reversible by: drop table public.math_game_scores; drop type math_game_difficulty;

begin;

do $$ begin
  create type math_game_difficulty as enum ('easy', 'medium', 'hard', 'genius');
exception when duplicate_object then null;
end $$;

create table if not exists public.math_game_scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  difficulty math_game_difficulty not null,
  score integer not null,
  played_at timestamptz not null default now()
);

create index if not exists math_game_scores_board_idx
  on public.math_game_scores(difficulty, score desc);
create index if not exists math_game_scores_student_idx
  on public.math_game_scores(student_id, difficulty);

alter table public.math_game_scores enable row level security;

commit;
