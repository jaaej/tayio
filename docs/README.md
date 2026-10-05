# Documentation index

This index defines which Taiyo Tuition Portal documents are current, which are
requirements or history, and what to trust when two files disagree.

**Full documentation audit completed:** 6 October 2026

## Authority order

Use this order when documents disagree:

1. Current code, SQL migrations, automated tests, and verified live behavior.
2. [`../checklist_beta_fix.md`](../checklist_beta_fix.md) for open acceptance
   work and owner QA.
3. [`AGENT_HANDOFF.md`](AGENT_HANDOFF.md) and [`features.md`](features.md) for
   current engineering and product behavior.
4. [`deploy.md`](deploy.md), [`runbooks.md`](runbooks.md), [`SECURITY.md`](SECURITY.md),
   [`security-checklist.md`](security-checklist.md), and
   [`client-dns-setup.md`](client-dns-setup.md) for current procedures.
5. The PRDs, old implementation checklist, dated briefs, plans, specs, change
   notes, and generated task reports as historical context only.

Package versions come from `package.json`, not from a dated plan.
Deployment state comes from Vercel and the live domain, not from a Git commit
alone.

## Current documents

| Document | Purpose |
| --- | --- |
| [`../README.md`](../README.md) | Project entry point, local setup, validation, and production summary |
| [`../checklist_beta_fix.md`](../checklist_beta_fix.md) | Active beta backlog and manual acceptance list |
| [`AGENT_HANDOFF.md`](AGENT_HANDOFF.md) | Current engineering state, open risks, and safe resume workflow |
| [`features.md`](features.md) | Current role-by-role feature reference |
| [`deploy.md`](deploy.md) | Deployment, environment, and migration runbook |
| [`runbooks.md`](runbooks.md) | Incident and recovery procedures |
| [`SECURITY.md`](SECURITY.md) | Implemented database and authorization model |
| [`security-checklist.md`](security-checklist.md) | Security verification status and release gates |
| [`client-dns-setup.md`](client-dns-setup.md) | Current Vercel and Resend DNS reference |

These files were reconciled with the repository and visible production
infrastructure on 6 October 2026.
Unverified external dashboard settings remain labelled as unverified rather
than being assumed complete.

## Requirements baselines

The four `PRD_*.md` files record original product intent for the student,
parent, tutor, and admin portals.
They are useful for understanding why a feature exists, but they are not a
shipped-feature checklist and their phase language is historical.

## Historical implementation records

- [`checklist.md`](checklist.md) is the legacy/full inventory last audited as a
  whole on 22 July 2026.
- [`briefs/`](briefs/) contains completed one-off agent assignments.
- [`changes/`](changes/) contains dated implementation snapshots and decision
  history.
- [`superpowers/specs/`](superpowers/specs/) contains dated design proposals.
- [`superpowers/plans/`](superpowers/plans/) contains dated execution plans.

Do not rewrite these files to describe the present because doing so would
destroy their historical meaning.
Instead, record current behavior in the current documents above and add a new
dated change note when useful.

## Generated and external documentation

- `.superpowers/sdd/` contains generated task briefs, progress files, reviews,
  and reports.
  They are implementation artifacts, not current product documentation.
- `.agents/skills/` contains installed tool and skill packages.
  Those files are external operating instructions and are outside the Taiyo
  product-documentation audit.

## Audit coverage

The 6 October 2026 audit:

- inventoried all root and `docs/` Markdown files;
- reconciled the current documents against package versions, routes,
  migrations, tests, DNS, Vercel project metadata, and production aliases;
- classified PRDs, briefs, plans, specs, change notes, and generated reports so
  dated statements cannot be mistaken for current state;
- checked all relative Markdown links across the root documents and `docs/`;
- found no broken relative links;
- corrected the stale Next.js version and checklist-authority instructions in
  `CLAUDE.md`.

Historical implementation records were classified and link-checked, not
rewritten line by line, because their purpose is to preserve what was believed
or planned on their date.
