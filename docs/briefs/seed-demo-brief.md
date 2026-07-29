You own the **Demo Seed Data** track. Right now the database has 4 test users and nothing else. Frontend agents are building UIs that look empty because there's no realistic data. Your job is to populate the database with believable Taiyo Tuition data so every page renders with meaningful content during development.

**Required reading first:**
- `src/db/schema.ts` - every table you'll seed
- `scripts/seed-users.mjs` - the existing pattern for using `@supabase/supabase-js` admin client + the Postgres connection
- `docs/PRD_*.md` - the kind of realistic content each role should see

**Your sandbox:**
- New file: `scripts/seed-demo.mjs` - idempotent script that populates everything
- Optionally: smaller helper modules in `scripts/_seed/` if the file grows past ~500 lines

Do not touch anything else. No source code, no schema changes, no role folders.

**Scope - populate realistic data:**
1. **Subjects** - VCE Maths Methods, Specialist Maths, Physics, Chemistry, Biology, English, Further Maths (Taiyo's actual offering from their website)
2. **Tutors** - 4-5 named tutors (e.g., Mr Lee, Ms Park, Dr Chen, Ms Tanaka) with realistic emails
3. **Students** - 12-15 students across Year 9, 10, 11, 12 with realistic Australian names and Melbourne schools (Mount Waverley SC, Glen Waverley SC, MGS, MHS, etc.)
4. **Parents** - one parent per family, some parents linked to 2-3 children via `family_links`. The existing `parent@taiyo.com` should be linked to the demo student `student@taiyo.com` plus 1-2 others so the parent dashboard's child-switcher has real data.
5. **Classes** - ~8-10 classes across subjects and year levels, each with an assigned tutor and a weekday/time recurrence
6. **Enrollments** - wire students into classes (mix: some students in 1 class, some in 3-4)
7. **Lessons** - generate ~6 weeks of lessons (3 weeks past, 3 weeks future) from the class schedules. Mix of `completed`, `upcoming`, `cancelled`, `missed`, `makeup` statuses for past lessons.
8. **Attendance** - fill in attendance rows for past lessons. Mix of `present`/`late`/`absent` weighted ~85/10/5%.
9. **Lesson notes** - for ~70% of past completed lessons, add a `lesson_notes` row. Realistic `parent_visible_comment` text (2-3 sentences), and a different `internal_note` field that the parent must never see (e.g., "Student seemed tired today, may need to check in with parents about workload"). This is critical for testing the parent-vs-internal visibility split.
10. **Homework** - ~3-5 homework items per active class, with `homework_assignments` rows for each enrolled student. Mix of statuses: not_started, viewed, submitted, marked. For marked work, include scores and feedback.
11. **Progress topics** - sprinkle ~5-8 topic mastery rows per student with a believable progression (not_started → needs_work → improving → strong)
12. **Invoices** - ~2-3 invoices per parent over the last 3 months. Mix of `paid`, `unpaid`, `overdue` statuses.
13. **Announcements** - 3-5 sample announcements (one to all parents, one to a specific class, one general)

**Critical constraints:**
- **Idempotent.** Running the script twice must not duplicate data. Use upserts keyed on natural keys (e.g., email for profiles, name+tutor+time for classes).
- **Preserve the 4 test accounts** (admin/student/parent/tutor@taiyo.com) - don't recreate or break them. Link the `student@taiyo.com` user as a real enrolled student so they have lessons/homework when they sign in.
- **Realistic dates.** Use `new Date()` math relative to today so past/future lessons stay correctly distributed every time the script runs (don't hardcode a date that becomes "the past" forever).
- **Australian context.** AUD currency, Melbourne suburbs, VCE terminology.

**Verify before claiming done:**
- Run `node scripts/seed-demo.mjs` from a clean DB → all tables populate without errors
- Run it again → no errors, no duplicates
- Sign in as each of the 4 test accounts and confirm every dashboard now shows real data (not empty states)
- Manually inspect `lesson_notes` to confirm `parent_visible_comment` and `internal_note` are clearly different content
- Document in `docs/SEED.md`: how to run, how to wipe & re-seed, the data shapes generated

**Workflow:**
```bash
git checkout -b feat/seed-demo main
git push -u origin feat/seed-demo
gh pr create
```

Coordinate with the user before running against the live Supabase project - the data is non-destructive but bulky.
