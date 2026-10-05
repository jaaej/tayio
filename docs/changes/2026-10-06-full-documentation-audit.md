# Full documentation audit

**Date:** 6 October 2026

## Scope

The audit inventoried 188 project Markdown files:

- 3 root documents: `README.md`, `CLAUDE.md`, and
  `checklist_beta_fix.md`;
- 87 files under `docs/`, including current references, PRDs, briefs, dated
  change notes, plans, and specifications;
- 98 generated task artifacts under `.superpowers/sdd/`.

The 61 Markdown files under `.agents/skills/` are installed third-party tool
instructions, not Taiyo product documentation, so they were explicitly
excluded from the product-content audit.

## What was verified

- The current operational documents were reconciled with installed package
  versions, source routes, migration files, tests, DNS, Vercel project
  metadata, and the production alias.
- Every root and `docs/` Markdown file was inventoried and assigned a clear
  current, requirements-baseline, or historical role in `docs/README.md`.
- All relative Markdown links across the root documents and `docs/` were
  resolved against the repository. No broken relative links remained.
- Current-document code and route references were checked against the source
  tree. Intentional filename templates, route-group URLs, dynamic routes, and
  explicitly retired historical routes were reviewed rather than counted as
  broken links.
- Dated plans, specs, change notes, and generated SDD reports were retained as
  history rather than rewritten to mimic current state.

## Corrections made

- Corrected `CLAUDE.md` from Next.js 16 to the installed Next.js 15 line.
- Made `checklist_beta_fix.md`, rather than the legacy `docs/checklist.md`, the
  active acceptance source in the agent rules.
- Labelled the PRD phase order as historical and made skill fallback behavior
  explicit when the named UI review skill is not installed.
- Added `docs/README.md` as the authoritative documentation index and conflict
  order.
- Added archive indexes for briefs, change history, design specs, execution
  plans, and generated SDD artifacts.
- Added visible requirements-baseline notices to all four PRDs and archive
  notices to all one-off briefs.
- Corrected `docs/features.md` to remove the retired tutor approval queue and
  deleted `/admin/enrolments` and `/admin/leaving` routes from its current
  behavior claims.
- Replaced stale security/runbook advice to replay an old migration range after
  an accidental schema push with snapshot-first incident recovery and exact
  schema comparison.
- Removed a stale hard-coded schema line reference from the deployment guide.

## Verification result

This was a documentation-only change after the code validation recorded in
`2026-10-06-production-documentation-sync.md`.
The audit reran repository link and path checks plus `git diff --check`.
No application source, database data, environment values, or deployment
configuration was changed by this pass.
