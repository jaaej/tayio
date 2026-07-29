# Resource Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a subject-scoped "additional content" resource library (practice papers, exam guides, promoted weekly tutor resources) that tutors/admins author, students/parents consume, and admins moderate.

**Architecture:** One new `resources` table + `resource_type` enum. Files reuse the existing `validateUpload` + private-bucket + signed-URL pattern (as in `discussions-storage.ts`); links are validated by `safe-url.ts`. Reads are scoped by `subject_id` to the caller's enrolment set at the app layer, with RLS as a backstop. Two authoring paths: direct-add, and opt-in promotion of a `tutor_week_attachments` row (referenced, not copied).

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle ORM (Postgres), Supabase Storage + Auth, Zod, Tailwind v4, Vitest.

## Global Constraints

- **Deploy-ready, not MVP** - no stubs; full validation, error handling, and access control on every task (per `CLAUDE.md`).
- **Never `drizzle-kit push` / `db:generate`** - it wipes all RLS. Apply SQL via `node scripts/apply-sql.mjs <file>` (per `reference_schema_apply_dbpush`). Stop the dev server before applying (locks).
- **Every new `pgTable` gets an RLS migration entry** (security-checklist A10).
- **Files stored as `storage_bucket` + `storage_path`, never a persisted public URL**; reads mint short-lived (1h) signed URLs (security E4/E5).
- **Uploads:** magic-byte sniff + size cap + allowlist; SVG excluded; canonical ext/content-type from the allowlist, not the client (E1/E3).
- **Subject-scoping is the core invariant:** a caller only ever receives resources for subjects in their scope (student = enrolled; parent = child's enrolled; tutor = taught; admin = all). Enforced in-query AND in RLS.
- **Guards:** writes are `requireRole(['tutor','admin'])`; tutors additionally `assertTeachesSubject`. Signed-URL action re-authorizes before minting.
- Match existing conventions: snake_case columns, `uuid` PK `defaultRandom()`, `timestamp(..., { withTimezone: true })`, `onDelete` refs, per-portal `_lib/queries.ts` + `_components/`, shared actions under `src/app/_actions/`.

Spec: `docs/superpowers/specs/2026-07-23-resource-library-design.md`.

---

## File Structure

**Create:**
- `supabase/migrations/0024_resources.sql` - enum, table, indexes, CHECK, RLS enable + policies, audit trigger.
- `src/lib/resources-storage.ts` - `uploadResourceFile`, `signResourceAttachment` (mirrors `discussions-storage.ts`).
- `src/lib/resources.ts` - scoping helpers + read queries shared across portals.
- `src/app/_actions/resources.ts` - server actions (add/update/promote/unpublish/remove/restore).
- `src/app/student/resources/_components/library-browser.tsx` - student browse UI (filters + open).
- `src/app/parent/resources/page.tsx` + `_components/` - parent read-only mirror.
- `src/app/admin/resources/page.tsx` + `_components/` - admin moderation.
- `src/app/tutor/resources/page.tsx` + `_components/resource-form.tsx` - tutor authoring for taught subjects.
- `src/lib/__tests__/upload-validation.resource.test.ts` - RESOURCE_POLICY unit tests.

**Modify:**
- `src/db/schema.ts` - add `resourceType` enum + `resources` table + relations.
- `src/lib/upload-validation.ts` - add `RESOURCE_POLICY`.
- `src/app/student/resources/page.tsx` - convert to `Library` + `Recorded lessons` tabs.
- The tutor curriculum week editor component (`src/app/tutor/classes/[id]/curriculum/_components/week-editor.tsx`) - add the "Also publish to library" toggle.
- The tutor weekly-attachment delete action - block deletion when the attachment has a published `resources` row (`source_attachment_id`).

---

## Task 1: Schema + migration (table, RLS, audit)

**Files:**
- Modify: `src/db/schema.ts`
- Create: `supabase/migrations/0024_resources.sql`

**Interfaces:**
- Produces: `resources` table + `resourceType` pgEnum exported from `schema.ts`; `Resource = typeof resources.$inferSelect`.

- [ ] **Step 1: Add enum + table to `src/db/schema.ts`** (place near other content tables; reuse existing imports `pgTable, pgEnum, uuid, text, integer, boolean, timestamp, index`)

```ts
export const resourceTypeEnum = pgEnum("resource_type", [
  "past_paper",
  "worksheet",
  "answer_sheet",
  "notes",
  "formula_sheet",
  "writing_template",
  "exam_guide",
  "video",
]);

export const resourceKindEnum = pgEnum("resource_kind", ["file", "link"]);

export const resources = pgTable(
  "resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").references(() => subjectTopics.id, {
      onDelete: "set null",
    }),
    type: resourceTypeEnum("type").notNull(),
    kind: resourceKindEnum("kind").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    storageBucket: text("storage_bucket"),
    storagePath: text("storage_path"),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes"),
    externalUrl: text("external_url"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    sourceAttachmentId: uuid("source_attachment_id").references(
      () => tutorWeekAttachments.id,
      { onDelete: "cascade" },
    ),
    isPublished: boolean("is_published").notNull().default(true),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: uuid("removed_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    removedReason: text("removed_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("resources_subject_published_idx").on(t.subjectId, t.isPublished),
    index("resources_subject_type_idx").on(t.subjectId, t.type),
    index("resources_topic_idx").on(t.topicId),
  ],
);

export type Resource = typeof resources.$inferSelect;
```

- [ ] **Step 2: Write the migration `supabase/migrations/0024_resources.sql`**

```sql
-- 0024_resources.sql - resource library table, RLS, audit
-- Reversible by: DROP TABLE resources; DROP TYPE resource_type; DROP TYPE resource_kind;

CREATE TYPE resource_type AS ENUM (
  'past_paper','worksheet','answer_sheet','notes',
  'formula_sheet','writing_template','exam_guide','video'
);
CREATE TYPE resource_kind AS ENUM ('file','link');

CREATE TABLE resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES subject_topics(id) ON DELETE SET NULL,
  type resource_type NOT NULL,
  kind resource_kind NOT NULL,
  title text NOT NULL,
  description text,
  storage_bucket text,
  storage_path text,
  content_type text,
  size_bytes integer,
  external_url text,
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  source_attachment_id uuid REFERENCES tutor_week_attachments(id) ON DELETE CASCADE,
  is_published boolean NOT NULL DEFAULT true,
  removed_at timestamptz,
  removed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  removed_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resources_kind_payload CHECK (
    (kind = 'file' AND storage_path IS NOT NULL) OR
    (kind = 'link' AND external_url IS NOT NULL)
  )
);

CREATE INDEX resources_subject_published_idx ON resources (subject_id, is_published);
CREATE INDEX resources_subject_type_idx ON resources (subject_id, type);
CREATE INDEX resources_topic_idx ON resources (topic_id);

-- RLS: app layer (postgres role / service-role) is primary; these are defense-in-depth,
-- mirroring the existing uncovered-tables policy style (migration 0012).
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- Students/parents read only published, non-removed rows for subjects in their scope.
-- is_enrolled_in_subject(uid, subject) helper already exists (see 0004/0009); if named
-- differently, match the existing curriculum read policy on subject_weeks.
CREATE POLICY resources_read_scoped ON resources FOR SELECT
  USING (
    is_published AND removed_at IS NULL
    AND (
      public.is_admin_like(auth.uid())
      OR public.teaches_subject(auth.uid(), subject_id)
      OR public.can_see_subject(auth.uid(), subject_id)
    )
  );

-- Writes: tutors for taught subjects, admins for all.
CREATE POLICY resources_write_tutor_admin ON resources FOR ALL
  USING (
    public.is_admin_like(auth.uid())
    OR public.teaches_subject(auth.uid(), subject_id)
  )
  WITH CHECK (
    public.is_admin_like(auth.uid())
    OR public.teaches_subject(auth.uid(), subject_id)
  );

-- Audit: reuse the audit_logs trigger function from migration 0006.
CREATE TRIGGER resources_audit
  AFTER INSERT OR UPDATE OR DELETE ON resources
  FOR EACH ROW EXECUTE FUNCTION public.record_audit();
```

> **Note for implementer:** the helper predicate names (`is_admin_like`, `teaches_subject`, `can_see_subject`, `record_audit`) MUST match what already exists. Before writing, grep the prior migrations: `grep -rn "CREATE OR REPLACE FUNCTION\|CREATE FUNCTION" supabase/migrations/` and the curriculum read policy (`subject_weeks`/`tutor_week_sections` in 0009/0010/0012). Use the exact existing names; do not invent new helpers. If a subject-visibility helper for students doesn't exist, add it in this migration mirroring the curriculum one.

- [ ] **Step 3: Stop the dev server, then apply the migration**

Run:
```bash
pkill -f "next dev"; pkill -f "next-server"
node scripts/apply-sql.mjs supabase/migrations/0024_resources.sql
```
Expected: no error; prints applied statements.

- [ ] **Step 4: Verify table + RLS live**

Run (adapt the inline env-load pattern already used in this repo's scripts):
```bash
node -e 'import("postgres").then(async({default:pg})=>{const sql=pg(process.env.DATABASE_URL||require("fs").readFileSync(".env.local","utf8").match(/DATABASE_URL=(.*)/)[1].trim(),{prepare:false});const [t]=await sql`select relrowsecurity from pg_class where relname=\x27resources\x27`;console.log("rls enabled:",t.relrowsecurity);const c=await sql`select count(*)::int n from resources`;console.log("selectable, rows:",c[0].n);await sql.end();})'
```
Expected: `rls enabled: true`, `selectable, rows: 0`.

- [ ] **Step 5: Update the docs & commit**

Add a row to `docs/security-checklist.md` §A (RLS) noting `resources` RLS is enabled (migration 0024), and add an §E row for the new bucket (Task 3 creates it). Update `docs/checklist.md` Student/Tutor/Admin "resource" rows per the maintenance protocol (they'll flip to 🔶 in-progress).

```bash
git add src/db/schema.ts supabase/migrations/0024_resources.sql docs/security-checklist.md docs/checklist.md
git commit -m "feat(resources): resources table + RLS + audit (migration 0024)"
```

---

## Task 2: RESOURCE_POLICY + unit tests

**Files:**
- Modify: `src/lib/upload-validation.ts`
- Test: `src/lib/__tests__/upload-validation.resource.test.ts`

**Interfaces:**
- Consumes: existing `validateUpload(file, policy)` and the policy shape (grep `DISCUSSION_POLICY` in `upload-validation.ts` for the exact structure - `{ maxBytes, allow: [{ mime, ext, family }] }` or similar).
- Produces: `RESOURCE_POLICY` exported from `upload-validation.ts`.

- [ ] **Step 1: Write failing tests** `src/lib/__tests__/upload-validation.resource.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { validateUpload, RESOURCE_POLICY } from "../upload-validation";

const file = (bytes: Uint8Array, name: string, mime: string) =>
  new File([bytes], name, { type: mime });

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const HTML = new TextEncoder().encode("<html><script>x</script></html>");

describe("RESOURCE_POLICY", () => {
  it("accepts a real PDF declared as pdf", async () => {
    const r = await validateUpload(file(PDF, "paper.pdf", "application/pdf"), RESOURCE_POLICY);
    expect(r.ok).toBe(true);
  });
  it("accepts a real PNG", async () => {
    const r = await validateUpload(file(PNG, "diagram.png", "image/png"), RESOURCE_POLICY);
    expect(r.ok).toBe(true);
  });
  it("rejects HTML spoofed as PDF (magic-byte mismatch)", async () => {
    const r = await validateUpload(file(HTML, "evil.pdf", "application/pdf"), RESOURCE_POLICY);
    expect(r.ok).toBe(false);
  });
  it("rejects SVG (XSS vector) even if well-formed", async () => {
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    const r = await validateUpload(file(svg, "x.svg", "image/svg+xml"), RESOURCE_POLICY);
    expect(r.ok).toBe(false);
  });
  it("rejects an oversize file", async () => {
    const big = new Uint8Array(RESOURCE_POLICY.maxBytes + 1);
    big.set(PDF);
    const r = await validateUpload(file(big, "huge.pdf", "application/pdf"), RESOURCE_POLICY);
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/__tests__/upload-validation.resource.test.ts`
Expected: FAIL - `RESOURCE_POLICY` is not exported.

- [ ] **Step 3: Add `RESOURCE_POLICY`** to `src/lib/upload-validation.ts` (mirror `CURRICULUM`/`DISCUSSION_POLICY` exactly; combine the doc allowlist with the 500MB video entry). Use the SAME allowlist entry objects the file already defines for pdf/png/jpeg/webp/gif/office/mp4/webm; set `maxBytes` per-family if the existing policy supports it, else set the policy `maxBytes` to the video cap and add a per-entry `maxBytes` for docs. Match the existing structure - do not restructure the module.

```ts
// Allow common study docs + images + video. SVG intentionally excluded (XSS).
export const RESOURCE_POLICY: UploadPolicy = {
  maxBytes: 500 * 1024 * 1024, // 500MB ceiling (video); docs capped lower per-entry below
  allow: [
    PDF_ENTRY,        // reuse the constants already defined in this file
    PNG_ENTRY,
    JPEG_ENTRY,
    WEBP_ENTRY,
    GIF_ENTRY,
    OOXML_ENTRY,      // docx/pptx/xlsx (office family)
    MP4_ENTRY,
    WEBM_ENTRY,
  ],
  // If the policy type carries a doc cap, set docMaxBytes: 25*1024*1024.
};
```

> If `UploadPolicy` has no per-entry cap concept, add a `perFamilyMax` field consistent with how `validateUpload` reads it, and enforce doc families at 25MB, video families at 500MB. Keep the change minimal and within the existing module's style.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/lib/__tests__/upload-validation.resource.test.ts`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/upload-validation.ts src/lib/__tests__/upload-validation.resource.test.ts
git commit -m "feat(resources): RESOURCE_POLICY upload validation + tests"
```

---

## Task 3: Storage helper + bucket

**Files:**
- Create: `src/lib/resources-storage.ts`

**Interfaces:**
- Consumes: `createAdminClient` (`src/app/admin/_lib/supabase-admin.ts`), `validateUpload` + `RESOURCE_POLICY`.
- Produces: `uploadResourceFile(subjectId, file) => {ok,value:{path,bucket,contentType,sizeBytes}} | {ok:false,error}`; `signResourceAttachment(bucket, path) => string|null`.

- [ ] **Step 1: Create the dev bucket** (private). Mirror how `discussion-attachments` was created; this is also a deploy step (track in security-checklist E-row).

Run:
```bash
node -e 'import("fs").then(async({readFileSync})=>{const env=Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(Boolean).filter(l=>!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["\x27]|["\x27]$/g,"")]}));const k=env.SUPABASE_SERVICE_ROLE_KEY,u=env.NEXT_PUBLIC_SUPABASE_URL;const r=await fetch(u+"/storage/v1/bucket",{method:"POST",headers:{apikey:k,Authorization:"Bearer "+k,"Content-Type":"application/json"},body:JSON.stringify({id:"resource-library",name:"resource-library",public:false})});console.log(r.status,(await r.text()).slice(0,120));})'
```
Expected: `200 {"name":"resource-library"}` (or already-exists).

- [ ] **Step 2: Write `src/lib/resources-storage.ts`** (mirror `src/lib/discussions-storage.ts` structure exactly)

```ts
import "server-only";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/app/admin/_lib/supabase-admin";
import { RESOURCE_POLICY, validateUpload } from "@/lib/upload-validation";

export const RESOURCE_BUCKET = "resource-library";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type UploadedResource = {
  bucket: string;
  path: string;
  contentType: string;
  sizeBytes: number;
};

export async function uploadResourceFile(
  subjectId: string,
  file: File,
): Promise<{ ok: true; value: UploadedResource } | { ok: false; error: string }> {
  const validated = await validateUpload(file, RESOURCE_POLICY);
  if (!validated.ok) return validated;

  const path = `${subjectId}/${randomUUID()}.${validated.file.ext}`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(RESOURCE_BUCKET)
    .upload(path, file, { contentType: validated.file.contentType, upsert: false });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    value: {
      bucket: RESOURCE_BUCKET,
      path,
      contentType: validated.file.contentType,
      sizeBytes: file.size,
    },
  };
}

/** Short-lived signed URL for a stored resource in any bucket (resource-library or curriculum). */
export async function signResourceAttachment(
  bucket: string,
  path: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}
```

- [ ] **Step 3: Verify a real upload lands** (run the app's exact path via a throwaway script, then delete the probe)

Run:
```bash
node -e 'import("fs").then(async({readFileSync})=>{const env=Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(Boolean).filter(l=>!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["\x27]|["\x27]$/g,"")]}));const k=env.SUPABASE_SERVICE_ROLE_KEY,u=env.NEXT_PUBLIC_SUPABASE_URL;const pdf=Buffer.from("255044462d","hex");const p="probe/ok.pdf";const r=await fetch(u+"/storage/v1/object/resource-library/"+p,{method:"POST",headers:{apikey:k,Authorization:"Bearer "+k,"Content-Type":"application/pdf"},body:pdf});console.log("upload",r.status);await fetch(u+"/storage/v1/object/resource-library/"+p,{method:"DELETE",headers:{apikey:k,Authorization:"Bearer "+k}});})'
```
Expected: `upload 200`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/resources-storage.ts docs/security-checklist.md
git commit -m "feat(resources): storage helper + private resource-library bucket"
```

---

## Task 4: Scoping helpers + read queries

**Files:**
- Create: `src/lib/resources.ts`

**Interfaces:**
- Consumes: `db` (`src/db/client.ts`), `resources`, `enrollments`, `classes`, `familyLinks`, `tutorAssignments`(or the existing "teaches" join) from `schema.ts`.
- Produces:
  - `enrolledSubjectIds(studentId: string): Promise<string[]>`
  - `childSubjectIds(parentId: string): Promise<string[]>` (via `family_links` → child → enrollments)
  - `taughtSubjectIds(tutorId: string): Promise<string[]>`
  - `type ResourceFilter = { type?: ResourceType; topicId?: string; q?: string }`
  - `listResourcesForSubjects(subjectIds: string[], filter?): Promise<Resource[]>` (published, not removed, ordered by createdAt desc)
  - `getResourceForViewer(id: string, allowedSubjectIds: string[]): Promise<Resource | null>` (authorization gate for signing)

> **No unit test for this module.** `resources.ts` is `import "server-only"` + DB-bound, so it cannot be imported in the node vitest environment (server-only throws; db needs a live connection). The empty-scope guard (`subjectIds.length === 0 → []`) and full subject-scoping are verified at **runtime** in Task 11, Step 1 (the cross-subject-leak test) - the real security check. Do not add a vitest file here.

- [ ] **Step 1: Implement `src/lib/resources.ts`**

```ts
import "server-only";
import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  resources,
  enrollments,
  classes,
  familyLinks,
  type Resource,
} from "@/db/schema";
import type { resourceTypeEnum } from "@/db/schema";

type ResourceType = (typeof resourceTypeEnum.enumValues)[number];
export type ResourceFilter = { type?: ResourceType; topicId?: string; q?: string };

export async function enrolledSubjectIds(studentId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ subjectId: classes.subjectId })
    .from(enrollments)
    .innerJoin(classes, eq(enrollments.classId, classes.id))
    .where(and(eq(enrollments.studentId, studentId), /* active */ isNull(enrollments.withdrawnAt)));
  return rows.map((r) => r.subjectId);
}
// NOTE: import isNull from drizzle-orm; use the actual enrollment→class→subject join
// that the curriculum queries already use (grep getStudentLessonsWithNotes / _lib/queries).

export async function childSubjectIds(parentId: string): Promise<string[]> {
  const kids = await db
    .select({ childId: familyLinks.childId })
    .from(familyLinks)
    .where(eq(familyLinks.parentId, parentId));
  const ids = new Set<string>();
  for (const { childId } of kids) {
    for (const s of await enrolledSubjectIds(childId)) ids.add(s);
  }
  return [...ids];
}

export async function taughtSubjectIds(tutorId: string): Promise<string[]> {
  // Use the existing "tutor teaches subject" join used by tutor curriculum pages.
  // Grep tutor/classes queries for the class→tutor relation; return distinct subjectIds.
  const rows = await db
    .selectDistinct({ subjectId: classes.subjectId })
    .from(classes)
    .where(eq(classes.tutorId, tutorId));
  return rows.map((r) => r.subjectId);
}

export async function listResourcesForSubjects(
  subjectIds: string[],
  filter: ResourceFilter = {},
): Promise<Resource[]> {
  if (subjectIds.length === 0) return [];
  const conds = [
    inArray(resources.subjectId, subjectIds),
    eq(resources.isPublished, true),
    isNull(resources.removedAt),
  ];
  if (filter.type) conds.push(eq(resources.type, filter.type));
  if (filter.topicId) conds.push(eq(resources.topicId, filter.topicId));
  if (filter.q) conds.push(ilike(resources.title, `%${filter.q}%`));
  return db.select().from(resources).where(and(...conds)).orderBy(desc(resources.createdAt));
}

export async function getResourceForViewer(
  id: string,
  allowedSubjectIds: string[],
): Promise<Resource | null> {
  if (allowedSubjectIds.length === 0) return null;
  const [row] = await db
    .select()
    .from(resources)
    .where(
      and(
        eq(resources.id, id),
        inArray(resources.subjectId, allowedSubjectIds),
        eq(resources.isPublished, true),
        isNull(resources.removedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}
```

> Fix imports (`isNull`) and align the enrolment/teaches joins with the exact relations the existing queries use (grep `src/app/student/_lib/queries.ts` and `src/app/tutor/**/_lib`). Do not invent column names - verify `classes.subjectId`, `classes.tutorId`, `enrollments.studentId/classId/withdrawnAt`, `familyLinks.parentId/childId` against `schema.ts`.

- [ ] **Step 2: Typecheck** - `npx tsc --noEmit` → no errors in `resources.ts` (fix any join/column/import mismatches against `schema.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/resources.ts
git commit -m "feat(resources): subject-scoping helpers + read queries"
```

---

## Task 5: Server actions (add / update / promote / moderate)

**Files:**
- Create: `src/app/_actions/resources.ts`

**Interfaces:**
- Consumes: `requireRole` (`@/lib/auth`), `taughtSubjectIds`, `uploadResourceFile`, `isSafeUrl` (from `src/lib/safe-url.ts` - grep its exact export), `withActor` (`src/lib/with-actor.ts`), `db`, `resources`, `tutorWeekAttachments`.
- Produces: `addResource(formData)`, `promoteAttachment(formData)`, `setResourcePublished(formData)`, `removeResource(formData)`, `restoreResource(formData)`. All return `{ok:true}|{ok:false,error}` except redirecting flows.

- [ ] **Step 1: Implement the actions** (Zod-validate every input; length-cap free text; guard subject ownership for tutors)

```ts
"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { resources, tutorWeekAttachments } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { coarseRole } from "@/lib/roles";
import { taughtSubjectIds } from "@/lib/resources";
import { uploadResourceFile } from "@/lib/resources-storage";
import { isSafeUrl } from "@/lib/safe-url"; // verify export name
import { withActor } from "@/lib/with-actor";
import type { UserRole } from "@/db/schema";

const TYPES = ["past_paper","worksheet","answer_sheet","notes","formula_sheet","writing_template","exam_guide","video"] as const;

async function assertCanAuthor(subjectId: string) {
  const user = await requireRole(["tutor", "admin"]);
  const role = coarseRole(user.app_metadata?.role as UserRole);
  if (role === "admin") return user;
  const taught = await taughtSubjectIds(user.id);
  if (!taught.includes(subjectId)) throw new Error("Forbidden");
  return user;
}

const addSchema = z.object({
  subjectId: z.string().uuid(),
  type: z.enum(TYPES),
  topicId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  kind: z.enum(["file", "link"]),
  externalUrl: z.string().url().max(2000).optional(),
});

export async function addResource(formData: FormData) {
  const parsed = addSchema.parse({
    subjectId: formData.get("subjectId"),
    type: formData.get("type"),
    topicId: formData.get("topicId") || undefined,
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    kind: formData.get("kind"),
    externalUrl: formData.get("externalUrl") || undefined,
  });
  const user = await assertCanAuthor(parsed.subjectId);

  let fileCols: Record<string, unknown> = {};
  if (parsed.kind === "link") {
    if (!parsed.externalUrl || !isSafeUrl(parsed.externalUrl))
      return { ok: false as const, error: "Invalid link" };
    fileCols = { externalUrl: parsed.externalUrl };
  } else {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0)
      return { ok: false as const, error: "No file" };
    const up = await uploadResourceFile(parsed.subjectId, file);
    if (!up.ok) return up;
    fileCols = {
      storageBucket: up.value.bucket,
      storagePath: up.value.path,
      contentType: up.value.contentType,
      sizeBytes: up.value.sizeBytes,
    };
  }

  await withActor(user, () =>
    db.insert(resources).values({
      subjectId: parsed.subjectId,
      topicId: parsed.topicId ?? null,
      type: parsed.type,
      kind: parsed.kind,
      title: parsed.title,
      description: parsed.description ?? null,
      uploadedBy: user.id,
      ...fileCols,
    }),
  );
  revalidatePath("/tutor/resources");
  revalidatePath("/admin/resources");
  return { ok: true as const };
}

const promoteSchema = z.object({
  attachmentId: z.string().uuid(),
  type: z.enum(TYPES),
  topicId: z.string().uuid().optional(),
});

export async function promoteAttachment(formData: FormData) {
  const parsed = promoteSchema.parse({
    attachmentId: formData.get("attachmentId"),
    type: formData.get("type"),
    topicId: formData.get("topicId") || undefined,
  });
  // Load the attachment to derive subjectId + storage path (grep tutorWeekAttachments columns).
  const [att] = await db
    .select()
    .from(tutorWeekAttachments)
    .where(eq(tutorWeekAttachments.id, parsed.attachmentId))
    .limit(1);
  if (!att) return { ok: false as const, error: "Attachment not found" };
  const subjectId = att.subjectId; // verify the column path to subject on this table
  const user = await assertCanAuthor(subjectId);

  // Idempotent: if already promoted + live, no-op.
  const [existing] = await db
    .select({ id: resources.id })
    .from(resources)
    .where(and(eq(resources.sourceAttachmentId, att.id), isNull(resources.removedAt)))
    .limit(1);
  if (existing) return { ok: true as const };

  await withActor(user, () =>
    db.insert(resources).values({
      subjectId,
      type: parsed.type,
      topicId: parsed.topicId ?? null,
      kind: "file",
      title: att.fileName ?? "Resource",
      storageBucket: "curriculum",
      storagePath: att.storagePath, // verify column
      contentType: att.contentType ?? null,
      uploadedBy: user.id,
      sourceAttachmentId: att.id,
    }),
  );
  revalidatePath("/tutor/resources");
  return { ok: true as const };
}

const idSchema = z.object({ id: z.string().uuid() });

export async function setResourcePublished(formData: FormData) {
  const { id } = idSchema.parse({ id: formData.get("id") });
  const published = formData.get("published") === "true";
  const user = await requireRole(["tutor", "admin"]);
  // tutors may only toggle their taught subjects; admins any. Load row → assertCanAuthor(subjectId).
  const [row] = await db.select().from(resources).where(eq(resources.id, id)).limit(1);
  if (!row) return { ok: false as const, error: "Not found" };
  await assertCanAuthor(row.subjectId);
  await withActor(user, () =>
    db.update(resources).set({ isPublished: published }).where(eq(resources.id, id)),
  );
  revalidatePath("/admin/resources");
  return { ok: true as const };
}

const removeSchema = z.object({ id: z.string().uuid(), reason: z.string().trim().max(500).optional() });

export async function removeResource(formData: FormData) {
  const parsed = removeSchema.parse({ id: formData.get("id"), reason: formData.get("reason") || undefined });
  const user = await requireRole("admin"); // moderation is admin-only
  await withActor(user, () =>
    db
      .update(resources)
      .set({ removedAt: new Date(), removedBy: user.id, removedReason: parsed.reason ?? null })
      .where(eq(resources.id, parsed.id)),
  );
  revalidatePath("/admin/resources");
  return { ok: true as const };
}

export async function restoreResource(formData: FormData) {
  const { id } = idSchema.parse({ id: formData.get("id") });
  const user = await requireRole("admin");
  await withActor(user, () =>
    db.update(resources).set({ removedAt: null, removedBy: null, removedReason: null }).where(eq(resources.id, id)),
  );
  revalidatePath("/admin/resources");
  return { ok: true as const };
}
```

> Verify against `schema.ts`: the exact `tutorWeekAttachments` columns (`subjectId`? or reached via `tutor_week_sections.week` → subject; `fileName`, `storagePath`, `contentType`). If the attachment doesn't carry `subjectId` directly, join through its section/week to get it. Verify `isSafeUrl` export name in `safe-url.ts`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `resources.ts` / `_actions/resources.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/_actions/resources.ts
git commit -m "feat(resources): server actions (add/promote/publish/remove/restore)"
```

---

## Task 6: Block-delete rule on promoted weekly attachments

**Files:**
- Modify: the tutor weekly-attachment delete action (grep `delete`/`removeAttachment` in `src/app/tutor/classes/[id]/curriculum/**` or `src/app/_actions`).

**Interfaces:**
- Consumes: `resources` table.

- [ ] **Step 1: Add a guard at the top of the attachment-delete action** - before deleting, check for a live promoted resource:

```ts
const [promoted] = await db
  .select({ id: resources.id })
  .from(resources)
  .where(and(eq(resources.sourceAttachmentId, attachmentId), isNull(resources.removedAt)))
  .limit(1);
if (promoted) {
  return {
    ok: false as const,
    error: "This file is published to the subject resource library. Remove it from the library first.",
  };
}
```

- [ ] **Step 2: Surface the error in the week-editor UI** - ensure the delete button shows the returned error (match how other action errors are shown in that component).

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit`
```bash
git add -A
git commit -m "feat(resources): block deleting a weekly attachment that is published to the library"
```

---

## Task 7: Tutor authoring UI

**Files:**
- Create: `src/app/tutor/resources/page.tsx`, `src/app/tutor/resources/_components/resource-form.tsx`
- Modify: the curriculum week-editor component to add the "Also publish to library" toggle → calls `promoteAttachment`.

**Interfaces:**
- Consumes: `taughtSubjectIds`, `listResourcesForSubjects`, `addResource`, `promoteAttachment`.

- [ ] **Step 1: Build `/tutor/resources`** - server component: `const user = await requireRole("tutor")`; `const subjectIds = await taughtSubjectIds(user.id)`; load each subject's name; render, per subject, the existing resources (`listResourcesForSubjects([subjectId])`) + a `<ResourceForm subjectId subjectTopics />`. Reuse tutor UI primitives (import from the tutor shell/card kit used by other tutor pages - grep `src/app/tutor/**/_components`).

- [ ] **Step 2: Build `ResourceForm`** (client component) - fields: type `<select>` (the 8 types), topic `<select>` (subject topics, optional), title, description, a **kind toggle** (Upload file / Paste link) that shows a `<input type=file>` OR a `<input type=url>`. Submits via `<form action={addResource}>` with hidden `subjectId`. Show returned `error`. Follow the composer pattern in `src/components/dm/message-composer.tsx` for file inputs + action error handling.

- [ ] **Step 3: Add the promote toggle to the week editor** - for each attachment, an "Also publish to [subject] library" button opens a tiny inline form (type select + optional topic) posting to `promoteAttachment` with the `attachmentId`. If already promoted, show "In library ✓" (query `resources.sourceAttachmentId` when loading the editor).

- [ ] **Step 4: Runtime check + commit** (dev server + seed `tutor@taiyo.com`)

Run the app; as the tutor, add one link resource + one file resource to a taught subject; confirm both appear in the `/tutor/resources` list. Promote a weekly attachment; confirm "In library ✓".
```bash
git add -A
git commit -m "feat(resources): tutor authoring UI + week promote toggle"
```

---

## Task 8: Student browse UI

**Files:**
- Modify: `src/app/student/resources/page.tsx` (tabs)
- Create: `src/app/student/resources/_components/library-browser.tsx`
- Create: the signed-URL open action (add `openResource(id)` to `src/app/_actions/resources.ts`, or a route handler) that calls `getResourceForViewer` with the student's `enrolledSubjectIds` then `signResourceAttachment`.

**Interfaces:**
- Consumes: `enrolledSubjectIds`, `listResourcesForSubjects`, `getResourceForViewer`, `signResourceAttachment`.

- [ ] **Step 1: Add `openResource` action** (authorizes before signing)

```ts
export async function openResource(id: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const user = await requireRole("student");
  const allowed = await enrolledSubjectIds(user.id);
  const row = await getResourceForViewer(id, allowed);
  if (!row) return { ok: false, error: "Not found" };
  if (row.kind === "link") return { ok: true, url: row.externalUrl! };
  const url = await signResourceAttachment(row.storageBucket!, row.storagePath!);
  return url ? { ok: true, url } : { ok: false, error: "Could not open" };
}
```

- [ ] **Step 2: Convert `/student/resources` to tabs** - `Library` (default) renders `<LibraryBrowser subjects=.../>`; `Recorded lessons` renders the existing recorded-lessons list (keep the current markup verbatim, just move it under a tab). Preserve the current page's data fetch for recorded lessons.

- [ ] **Step 3: Build `LibraryBrowser`** - server component loads `enrolledSubjectIds` + each subject's resources + topics; groups by subject; client sub-component holds filter state (type chips, topic select, title search) filtering the already-loaded rows client-side (lists are small). Each item is a button calling `openResource(id)` then `window.open(url)` for links / triggering download for files. Use existing student card primitives.

- [ ] **Step 4: Commit**
```bash
git add -A
git commit -m "feat(resources): student library browse + tabs + signed open"
```

---

## Task 9: Parent read-only mirror

**Files:**
- Create: `src/app/parent/resources/page.tsx` + `_components/`
- Add a nav entry in the parent shell.

**Interfaces:**
- Consumes: `childSubjectIds`, `listResourcesForSubjects`, a parent `openResource` variant authorizing via `childSubjectIds`.

- [ ] **Step 1:** Build `/parent/resources` mirroring `LibraryBrowser` but scoped via `childSubjectIds(user.id)` and a child switcher if multiple children (reuse the existing parent child-switcher pattern). Read-only - no form, no moderate.
- [ ] **Step 2:** Add `openResourceForParent(id)` authorizing with `childSubjectIds`. 
- [ ] **Step 3:** Add the nav link in the parent shell (grep `src/components/parent` or the parent shell nav).
- [ ] **Step 4: Commit** - `git commit -m "feat(resources): parent read-only mirror"`

---

## Task 10: Admin moderation UI

**Files:**
- Create: `src/app/admin/resources/page.tsx` + `_components/`
- Add nav entry in the admin shell (grep `src/components/admin/shell.tsx` nav list).

**Interfaces:**
- Consumes: `setResourcePublished`, `removeResource`, `restoreResource`, a broad admin list query (all subjects, incl. removed).

- [ ] **Step 1:** Admin list query `listAllResourcesForAdmin(filter)` in `src/lib/resources.ts` - returns rows across all subjects incl. removed, with uploader name + provenance (`sourceAttachmentId IS NOT NULL` → "promoted"). Filters: subject, type, status (live/unpublished/removed).
- [ ] **Step 2:** Build `/admin/resources` - table with columns Title · Subject · Type · Source · Uploader · Status, and row actions Unpublish/Republish, Remove (with reason prompt), Restore. Use admin UI kit (`@/components/admin/ui`).
- [ ] **Step 3:** Add nav entry `Resources` under an appropriate admin section.
- [ ] **Step 4: Commit** - `git commit -m "feat(resources): admin moderation UI"`

---

## Task 11: End-to-end runtime verification

**Files:** none (verification only). Use the `verify` skill's method; drive the running app with seed users (`student@taiyo.com`/`student` restricted, `student.pro@taiyo.com`/`student` unrestricted, `tutor@taiyo.com`/`tutor`, `parent@taiyo.com`/`parent`, `admin@taiyo.com`/`admin`) via the hand-built SSR cookie (see `reference_seed_login_curl`).

- [ ] **Step 1 - security-critical (no cross-subject leak):** As a tutor, add a resource to Subject A. As a student enrolled in A → it appears. As a student NOT enrolled in A → the `/student/resources` Library shows nothing for A, and calling `openResource(id)` returns `{ok:false}`. Capture both responses.
- [ ] **Step 2 - cross-class visibility:** With two classes of Subject A taught by different tutors, promote a weekly attachment in class 1; confirm a student in class 2 sees it in the library.
- [ ] **Step 3 - block-delete:** Attempt to delete the promoted weekly attachment → blocked with the library message.
- [ ] **Step 4 - moderation + audit:** As admin, Remove a resource → it disappears from the student Library; confirm an `audit_logs` row with the admin actor. Restore → reappears.
- [ ] **Step 5 - signed URL:** Open a file resource → signed URL returns the file; confirm it 404s after `SIGNED_URL_TTL_SECONDS` (or that the URL carries a short expiry).
- [ ] **Step 6 - parent mirror:** As parent, confirm the library shows only the child's subjects; no add/remove controls.
- [ ] **Step 7:** Update `docs/checklist.md` (flip resource rows to ✅ with routes), `docs/features.md` (add the resource-library feature entries per role), and `docs/security-checklist.md` (bucket row → done in dev / pending prod). Commit.
```bash
git commit -m "docs(resources): flip checklist/features/security to reflect shipped resource library"
```

---

## Self-Review

- **Spec coverage:** data model (T1) · RESOURCE_POLICY (T2) · storage+bucket (T3) · subject-scoping incl. parent (T4) · add/promote/moderate actions (T5) · reference+block-delete (T6) · tutor authoring + promote toggle (T7) · student tabs+browse+signed open (T8) · parent mirror (T9) · admin moderation + audit (T10) · full test plan incl. cross-subject-leak (T11). All spec sections mapped.
- **Placeholders:** backend tasks carry real code; UI tasks (T7–T10) specify exact files, data calls, and an existing component to mirror rather than full JSX - deliberate, since they parallel existing pages the implementer will read. No "TBD"/"add validation"-style gaps.
- **Type consistency:** `resources` columns, action names (`addResource`/`promoteAttachment`/`setResourcePublished`/`removeResource`/`restoreResource`/`openResource`), and helper names (`enrolledSubjectIds`/`childSubjectIds`/`taughtSubjectIds`/`listResourcesForSubjects`/`getResourceForViewer`) are used consistently across tasks.
- **Verification-dependent names:** several joins/helper predicates (SQL `is_admin_like`/`teaches_subject`/`can_see_subject`/`record_audit`; `tutorWeekAttachments` subject/path columns; `isSafeUrl`) are explicitly flagged to verify against existing code before use, because they must match established names.
