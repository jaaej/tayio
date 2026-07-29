# Student Math Game ("Math Sprint") - Design

**Date:** 2026-07-12
**Status:** Approved design, pending user spec review
**Portal:** Student only

A Zetamac-style mental-math speed drill for students. Pick one of four difficulty tiers, solve as many typed-answer arithmetic questions as possible in 60 seconds, then land on a per-difficulty leaderboard. A satisfying, user-pickable sound plays on each correct answer. Entry point is a purple gradient CTA block at the bottom of the student sidebar.

## Goals / non-goals

**Goals (v1):** four difficulty tiers, 60s timed runs, typed integer answers with auto-advance, per-difficulty leaderboards (first name + last initial), pick-your-sound feedback, purple gradient hero identity.

**Non-goals (v1):** XP / leveling system (leaderboard is the only progression), algebra / expression-parsing tiers, per-question analytics, head-to-head multiplayer, server-authoritative anti-cheat.

## Difficulty tiers

Every question in every tier resolves to a **single whole integer**. All division is generated as `divisor × quotient` so it divides cleanly (**no remainders anywhere, including Genius**). Percentages are chosen so the result is a whole number. Nothing ever produces a fraction or remainder.

| Tier | Content | Generation rules |
|------|---------|------------------|
| **Easy** | Addition only, 2-digit | `a + b`, `a,b ∈ [1,99]` |
| **Medium** | Add/subtract 2-digit; times-tables | add: `a,b ∈ [10,99]`; sub: `a ∈ [10,99]`, `b ∈ [10,a]` (non-negative); mult: `a ∈ [2,12] × b ∈ [2,9]` |
| **Hard** | Four operations, Zetamac band | add/sub 2-digit (sub non-negative); mult `a ∈ [2,12] × b ∈ [2,100]`; div: `d ∈ [2,12]`, `q ∈ [2,100]`, show `(d·q) ÷ d`, answer `q` |
| **Genius** | 3-digit ±, 2-digit ×, order-of-ops, negatives, squares/cubes, % | add3/sub3: `a,b ∈ [100,999]` (sub **may be negative**); mult2: `a,b ∈ [11,99]`; div: `d ∈ [3,20] × q ∈ [10,50]`, clean; orderOps: `a + b×c` / `(a+b)×c` with small integer operands, integer result; squares `n²` (`n ∈ [10,25]`), cubes `n³` (`n ∈ [5,12]`); percent: `p ∈ {10,20,25,50,75}` of a base chosen so `p%` is a whole number (e.g. `25% of 80`) |

Each tier picks uniformly at random among its allowed forms per question.

**Why not mirror Mathletics Level 10?** Mathletics' top levels (8–10) are secondary-school algebra (factoring quadratics, logarithms, solving equations). Those need an expression parser / CAS or multiple-choice input and break the reflex-drill feel, so they are explicitly out of scope. A future algebra mode would be a separate feature (multiple-choice + question bank), not random-number generation.

## Gameplay flow

Difficulty picker → `3-2-1` countdown → **60s** timer → one large question at a time → typed numeric input (`inputMode="numeric"`, auto-focused).

- **Auto-advance:** the moment the parsed input equals the answer, score +1 and the next question appears. Enter also submits. Leading `−` is allowed for Genius negatives.
- **Wrong input:** no penalty, no advance - keep trying until correct or time runs out. **No skip** in v1.
- **On correct:** play the selected sound.
- **Time up:** score summary - questions solved, personal-best comparison for that tier, your leaderboard rank, and *Play again* / *Back* buttons.

State machine (client): `idle → countdown → playing → done`.

## Sound

- 4 bundled short audio files in `public/sounds/` (e.g. `coin`, `pop`, `ding`, `zap`) plus a **Mute** option.
- Preloaded and played via the **Web Audio API** (decoded into buffers) for zero-latency playback - an HTML `<audio>` element lags too much for rapid-fire play.
- Sound picker sits on the pre-game / difficulty screen; the chosen sound is saved to **`localStorage`** (no schema change, no server round-trip). Default: `coin`.

## Data model (greenfield, follows UUID + timestamp conventions)

- `mathGameDifficultyEnum = pgEnum("math_game_difficulty", ["easy","medium","hard","genius"])`
- **`math_game_scores`** - append-only, one row per completed run:
  - `id` uuid pk `defaultRandom()`
  - `studentId` uuid → `profiles.id`
  - `difficulty` `mathGameDifficultyEnum`
  - `score` integer notNull (questions solved)
  - `playedAt` timestamptz notNull `defaultNow()`
  - Indexes: `(difficulty, score desc)` for the leaderboard; `(studentId, difficulty)` for personal best.
- RLS: enable row-level security, no client policies (all access is server-side Drizzle as the postgres role, matching the existing deny-by-default model).

No per-question table - overkill for MVP.

**Leaderboard query:** `max(score)` per student per difficulty, tie-break by earliest `playedAt` (first to reach the score ranks higher), joined to `profiles` for the name. Top ~20 rows plus, if the current student is outside the top 20, a "your rank: #N" row. **Name shown = first name + last initial**, computed server-side. No emails / ids exposed.

## Routes & files (follows the `_queries` / `_actions` / `_components` pattern)

```
src/app/student/math-game/
  page.tsx                    # server component: hero + difficulty picker + my-bests + leaderboard; requireRole("student")
  _queries.ts                 # getLeaderboard(difficulty), getMyBests(studentId)
  _actions.ts                 # submitScore(difficulty, score) - Zod + auth + plausibility cap
  _components/
    game-client.tsx           # "use client": state machine, 60s timer, input handling, sound trigger
    question-generator.ts      # pure { text, answer } generators per tier - UNIT TESTED
    sound.ts                   # Web Audio load/play + localStorage sound preference
    difficulty-picker.tsx      # tier cards + sound picker
    leaderboard.tsx            # per-difficulty tabs, top ~20 + "your rank" row
    score-summary.tsx          # end-of-run screen
public/sounds/                 # coin / pop / ding / zap audio files
```

The **question generator is TDD'd** - correctness of generated answers (clean division, order-of-operations, negatives, percentages) actually matters and is the one pure, high-value unit to test first.

## Visual identity - purple gradient hero

Distinct "arcade" identity, separate from the portal's cornflower-blue theme. Built fresh (not an existing component). Gradient reference from the user's screenshot (exact hex to be sampled off the screenshot at build time; approximate stops):

- Left→right (slight downward angle): `#7B6EF0` → `#6D3BD6` → `#5A21B0`
- Soft radial light-bloom in the top-right corner
- ~24px corner radius; translucent rounded-square avatar/icon tile; white text
- **No XP/level bar** (that element in the reference screenshot is out of scope for v1)

Two placements share this gradient:
1. **Sidebar CTA block** - a compact gradient `<Link>` at the bottom of the sidebar footer in `src/components/student/shell.tsx` (e.g. "Math Sprint - Play & climb the board"). Primary entry point. The existing nav `SECTIONS` list is left untouched (surgical change).
2. **Game page hero** - a full-width gradient header on `/student/math-game`.

## Server action & integrity

`submitScore(difficulty, score)`:
- `requireRole("student")`; Zod-validate `difficulty` (enum) and `score` (int ≥ 0).
- **Plausibility cap** per difficulty (reject humanly-impossible scores): easy 150, medium 120, hard 100, genius 80. Reject out-of-range.
- Insert one `math_game_scores` row; `revalidatePath("/student/math-game")`.

**Known MVP limitation (honest):** the game runs client-side and POSTs a final score, so a determined student could forge a score. Server-authoritative validation would need per-answer round-trips, which latency-kills a reflex game. The plausibility cap is a guardrail, not a guarantee. Acceptable for a fun engagement feature; no academic grade depends on it.

## Access

Available to **all** students (both role tiers) via `requireRole("student")`. Not gated by `student_unrestricted`.

## Testing

- **Unit (TDD):** `question-generator.ts` - for each tier and form, assert the returned `answer` equals evaluating `text`; assert all answers are integers; assert Genius division/percent/order-of-ops never produce remainders; assert Easy/Medium subtraction is non-negative; assert operand ranges.
- **Unit:** `submitScore` plausibility cap rejects over-cap and negative scores.
- **Manual / device test:** full game loop (countdown → typing → auto-advance → time-up → summary), sound playback + picker + mute persistence, leaderboard ranking and "your rank" row, sidebar gradient block navigation, mobile numeric keypad.
