# 2026-08-03 - admin tasks (tutor directory + financial & student reports)

Branch: `feat/reschedule-credits`.
All code-complete with typecheck + `npm run build` (48 pages) + `npm test` (81/81) green.
Not browser-verified - that's your QA.

## Apply these before runtime testing

Three additive migrations are NOT yet applied to Supabase. Apply each SQL file
directly (never `drizzle-kit push` - it wipes RLS):

- `supabase/migrations/0035_tutor_bank_details.sql` - owner-only tutor payroll table (`/admin/tutors`).
- `supabase/migrations/0036_quiz_attempts.sql` - persisted quiz scores (feeds student reports).

All three new tables use RLS-on/no-policies (server-only access) and are added to `scripts/check-rls.mjs`.

New dependency: **`@react-pdf/renderer`** (added to package.json) - server-side branded PDF generation. Run `npm install` if the lockfile isn't picked up.

## What shipped (newest first)

| Commit | What |
|---|---|
| `aebda81` | **Student term reports** - `getStudentTermReport` (attendance %, per-subject quiz+test grades, tutor comments) → branded PDF. Role-aware download route `/reports/[studentId]/[termId]` (admin / unrestricted-student-self / parent-of-child). Admin "Term reports" card on `/admin/users/[id]`: term picker + Download + "Issue to family" (`issueStudentReport` notifies student-if-unrestricted + parents; lands in the Learning group). |
| `3b75100` | **Quiz-score persistence + grade scheme** - migration 0036 `quiz_attempts`; `gradePracticeQuiz` now records each attempt. `src/lib/report-grade.ts`: A≥90/B/C/D/F, quiz+test averaged equally (8 unit tests). |
| `ddc9454` | **Financial report PDF** - "Financial report" card on `/admin/revenue` (this month / last month / by term / custom) downloads a branded PDF of revenue collected + overdue, from `/admin/revenue/report`. Reuses the revenue PIN gate (owner \|\| unlocked). |
| `101444a` | **Owner-only tutor directory** - `/admin/tutors` (migration 0035): every active tutor with taught subjects (from assigned classes), schedule, and editable payroll bank details. Owner-only nav item; reception bounced. |

## Decisions taken this session

- **Grade bands** (you said my call): A≥90, B 80-89, C 70-79, D 60-69, F<60; quiz and test averages weighted equally; a component missing → the other is used alone.
- **Test scores read as percentages** - there's no per-test max column to normalise against, so tutor-entered `score` is treated as 0-100.
- **Quiz retake policy**: every attempt stored; the report uses the **latest** attempt per quiz.
- **AI report-drafting: parked** (your call) - reports use the tutor's parent-visible comments verbatim.
- **PDF brand**: portal indigo identity for now (`src/lib/pdf/brand.ts`) - swap in one place when real assets arrive.
- **Payments cluster: parked** (you said wait).

## Pending manual QA (browser)

### Admin - `/admin/tutors` (owner only)
- [ ] As owner: page lists tutors with subjects + schedule; enter/save bank details, reload persists. As reception (`reception@taiyo.com`): no "Tutors" nav item; `/admin/tutors` redirects to `/admin`.

### Admin - financial report (`/admin/revenue`)
- [ ] As owner: pick This month / By term / Custom → Download PDF renders with revenue + overdue. As reception: locked until PIN entered; after unlocking, download works.

### Student reports (`/admin/users/[id]` for a student)
- [ ] "Term reports" card: pick a term → Download PDF shows attendance, per-subject grades, tutor comments. (Grades populate only after migration 0036 + some quiz attempts / marked `is_test` homework exist.)
- [ ] "Issue to family": as a linked parent, the notification appears (Learning group) and its link downloads the PDF. Confirm a **restricted** student is NOT notified and gets 403 opening the route; an **unrestricted** student can.

## Still open (parked by you)
- Payments cluster (processor decision).
- Auto-find tutor replacements + term-end auto-messages (need email/scheduled-job infra; email = personal Gmail via Gmail API, to be wired later).
- AI report-note drafting.
- Real brand assets for the PDFs.
