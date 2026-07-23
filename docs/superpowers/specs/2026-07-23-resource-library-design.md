# Resource Library — Design Spec

**Date:** 2026-07-23
**Status:** Approved (design); pending implementation plan
**Scope:** Cross-portal feature (Tutor + Admin author; Student + Parent consume)

## Purpose

A library of **"additional" learning content** that sits *alongside* the existing
week-by-week curriculum, not inside it. It gives students supplementary material
(practice/past exam papers, exam guides, formula sheets, etc.) plus a durable,
subject-wide home for weekly tutor resources that would otherwise be visible only
to one tutor's class.

This is a **deploy-ready, final-product** feature — no stubs, proper validation,
security, and moderation. It is distinct from:
- **Curriculum** (`subject_weeks` / `tutor_week_sections` / `tutor_week_attachments`) —
  week-anchored delivery to a specific class.
- **`/student/resources` "recorded lessons"** — the current lesson-recap list (kept
  as a secondary tab).
- **Practice Quizzes** (PRD §9) — a separate feature, out of scope here.

## Decisions (settled during brainstorming)

| Decision | Choice |
|---|---|
| Purpose | "Additional" library alongside the week curriculum |
| Content sources | (a) directly-added materials + (b) opt-in promotion of a weekly tutor resource |
| Visibility | **Subject-scoped, cross-class** — every student enrolled in that subject, and only that subject |
| Approval | **Instant publish + admin moderation** (unpublish / remove) |
| Media | Per-resource `kind`: **file upload OR link**, author's choice (incl. video-as-upload up to 500MB, or video-as-link) |
| Filters | **Subject + type + topic** (topic reuses `subject_topics`) |
| Parents | **In scope** — read-only mirror of their child's subject resources |
| Promoted-file lifecycle | **Reference the original curriculum object (no copy); block deletion of a promoted attachment** |

**Core rationale — subject scoping:** a student sees library items only for subjects
they are actively enrolled in (paid for). This prevents students accessing material
for subjects they did not pay for, i.e. no resource leakage across cohorts. This is
the single most important invariant and is enforced at both the app layer and RLS.

## Data model

New enum + one table, following `schema.ts` conventions (snake_case, uuid PK,
`withTimezone` timestamps, `onDelete` refs).

```
resource_type enum:
  past_paper | worksheet | answer_sheet | notes |
  formula_sheet | writing_template | exam_guide | video

resources
  id                    uuid pk default random
  subject_id            uuid → subjects.id            NOT NULL   -- scoping key
  topic_id              uuid → subject_topics.id      NULL       -- optional filter
  type                  resource_type                 NOT NULL
  kind                  'file' | 'link'               NOT NULL
  title                 text                          NOT NULL
  description           text                          NULL
  -- file case:
  storage_bucket        text                          NULL  -- 'resource-library' | 'curriculum' (promoted)
  storage_path          text                          NULL
  content_type          text                          NULL
  size_bytes            integer                       NULL
  -- link case:
  external_url          text                          NULL
  -- provenance + moderation:
  uploaded_by           uuid → profiles.id            NOT NULL
  source_attachment_id  uuid → tutor_week_attachments.id NULL  -- set when promoted from a week
  is_published          boolean default true          NOT NULL  -- instant publish; author/admin can hide
  removed_at            timestamptz                   NULL      -- admin moderation soft-delete
  removed_by            uuid → profiles.id            NULL
  removed_reason        text                          NULL
  created_at            timestamptz default now       NOT NULL

  CHECK ((kind='file' AND storage_path IS NOT NULL) OR (kind='link' AND external_url IS NOT NULL))
  indexes: (subject_id, is_published), (subject_id, type), (topic_id)
```

Notes:
- **`storage_bucket` + `storage_path`** (never a persisted public URL) so reads always
  mint short-lived signed URLs — same pattern as homework / curriculum / discussion
  attachments (security checklist E4/E5).
- **`source_attachment_id`** distinguishes *promoted* (references a curriculum object)
  from *directly-added* (its own object in the `resource-library` bucket).
- **`is_published`** (temporary hide) vs **`removed_at`** (admin moderation, with
  actor + reason) are separate on purpose, mirroring the discussions soft-delete.

## Add / promote flow

**① Direct add** (standalone materials):
- Surface: a subject-scoped "Resources" area. **Tutors** add to subjects they teach
  (`assertTeachesSubject`); **admins** to any subject.
- Form: type · topic (optional) · title · description · `kind` toggle (Upload file / Paste link).
- File → `validateUpload(file, RESOURCE_POLICY)` → upload to `resource-library` bucket at
  `${subjectId}/${randomUUID}.${ext}` → insert row (`kind='file'`, bucket+path+content_type+size).
- Link → validate with `safe-url.ts` → insert row (`kind='link'`, `external_url`).

**② Promote a weekly resource** (opt-in):
- On the tutor curriculum week editor, each attachment gets an **"Also publish to the
  [subject] resource library"** toggle; when ticked the tutor picks a `type` (+ optional topic).
- On save → insert a `resources` row with `source_attachment_id` = that attachment,
  `storage_bucket='curriculum'` and the **same** existing `storage_path` (no re-upload,
  no duplication).

**File-lifecycle rule (promoted resources):** because a promoted resource *references*
the curriculum object, deleting that weekly attachment would orphan it. Deletion of a
promoted attachment is therefore **blocked** with a clear message: *"This is published
to the subject resource library. Remove it from the library first."* One source of
truth, no duplication, no orphans.
- *Rejected alternative:* copy-on-promote into `resource-library` (independent/frozen
  library copy) — rejected because a 500MB video would be stored twice; videos can also
  just be links.

**Write guards:** `requireRole(['tutor','admin'])`; tutors additionally
`assertTeachesSubject(subjectId)`. Admins unrestricted.

## Student & parent browse

**Student — `/student/resources`** becomes the library. Tabs: **`Library`** (primary) ·
**`Recorded lessons`** (the existing recap list, preserved).

Scoping query (the security boundary):
```
resources
  WHERE subject_id IN (subjects the student is actively enrolled in)   -- via enrollments
    AND is_published = true
    AND removed_at IS NULL
```

Browse UX:
- Grouped by **subject**.
- Per subject: filter chips for **type** and **topic** (`subject_topics`), plus title search.
- Each item: type badge, topic chip, file/link icon, title + description.

Opening:
- `kind='file'` → mint a short-lived signed URL via the service-role client (the
  `signDiscussionAttachment` pattern), reading from the row's `storage_bucket`. Never a
  persisted public URL.
- `kind='link'` → open `external_url` in a new tab, `rel="noopener noreferrer"`
  (URL already validated at write time).

**Parent — `/parent/...`**: read-only mirror scoped to the *child's* enrolled subjects
(via `family_links` → child → `enrollments`). No add, no moderate.

## Admin moderation

**Surface: `/admin/resources`** — every resource across all subjects, filters
(subject / type / status), columns for uploader, provenance (direct vs promoted), and
published/removed state.

Actions:
- **Unpublish / republish** → toggles `is_published`.
- **Remove** → soft-delete (`removed_at`, `removed_by`, `removed_reason`); vanishes from
  student/parent views, stays in table for audit + restore.
- **Restore** → clears removal fields.
- **Add / edit** any resource on any subject.

**Audit:** `resources` is added to the `audit_logs` trigger set (migration 0006 pattern)
so insert / unpublish / remove are logged with actor via `withActor` (security G1/G3).

## Security

- **Primary (app layer):** every read filters `subject_id` to the caller's scope
  (student = enrolled; parent = child's enrolled; tutor = taught; admin = all). Every
  write is `requireRole` + `assertTeachesSubject`. The signed-URL action re-authorizes
  "can this caller see this resource?" before minting a URL.
- **Backstop (RLS):** `resources` gets RLS enabled + policies mirroring the above via a
  raw-SQL migration (A10 discipline; never `db:push`). Defense-in-depth (C6).
- **Uploads:** `RESOURCE_POLICY` — magic-byte sniff, size caps (docs 25MB / video 500MB),
  allowlist, **SVG excluded**, canonical ext/content-type from the allowlist not the
  client (E1/E3).
- **Links:** `safe-url.ts` validation (block `javascript:` / `data:` etc.).
- **New private `resource-library` bucket** — must be created at deploy (track in
  `security-checklist.md`, like E7). Signed URLs short-lived (E5).

## Testing plan

To be executed (runtime, seed users) before the feature is claimed done — same rigor as
the math-game verification.

- **Unit:** `RESOURCE_POLICY` (valid pdf / image / video pass; html- or exe-spoofed-as-pdf,
  svg, oversize → rejected); `safe-url` link cases.
- **Runtime — security-critical:** a student enrolled in Subject A sees A's resources; a
  student **not** enrolled in A gets **nothing** (no cross-subject leak). Parent mirror
  respects the child's enrolment set.
- **Runtime — flows:** tutor direct-add (file + link) → visible to an enrolled student;
  promote a weekly attachment → visible subject-wide to a *different* tutor's student;
  block-delete on a promoted attachment fires; admin remove → disappears from student view
  + `audit_logs` row with actor; signed URL opens then expires; RLS backstop returns
  nothing for an other-subject/anon JWT.

## Out of scope (this spec)

- Practice quizzes (PRD §9).
- Year-level and difficulty filters (chose subject + type + topic).
- Direct video *streaming* transcoding — uploaded videos are downloaded/played via signed
  URL as-is; heavy media can instead be a link.
- Recommended-resources engine (PRD "recommended resources") — future.
