-- 0023 — add "sprint" tier to the math game difficulty enum
--
-- New easiest tier (addition only, operands 1..20), placed first in sort
-- order (before 'easy'). ALTER TYPE ... ADD VALUE is idempotent via
-- IF NOT EXISTS and cannot run inside an explicit transaction block, so this
-- migration is a single standalone statement (no begin/commit).
--
-- Reversible by: none cleanly — Postgres cannot drop an enum value. To undo,
-- recreate the type without 'sprint' and re-cast the column (destructive).

alter type math_game_difficulty add value if not exists 'sprint' before 'easy';
