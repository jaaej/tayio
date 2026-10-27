"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  classWeekPlanAttachments,
  classWeekPlans,
  resources,
  subjectWeeks,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { coarseRole } from "@/lib/roles";
import {
  taughtSubjectIds,
  enrolledSubjectIds,
  childSubjectIds,
  getResourceForViewer,
} from "@/lib/resources";
import { uploadResourceFile, signResourceAttachment } from "@/lib/resources-storage";
import { resourceDownloadName } from "@/lib/resource-format";
import { resourceFormat } from "@/lib/resource-meta";
import { officePreviewFits, viewableFileKind, type ViewableFileKind } from "@/lib/file-viewer";
import { markupFileKind } from "@/lib/markup/doc";
import { httpHref } from "@/lib/safe-url";
import { withActor } from "@/lib/with-actor";
import type { UserRole } from "@/db/schema";

const TYPES = [
  "past_paper",
  "worksheet",
  "answer_sheet",
  "notes",
  "formula_sheet",
  "writing_template",
  "exam_guide",
  "video",
] as const;

// Returns the Supabase user after asserting they can author resources for the given subjectId.
// Admins pass unconditionally; tutors must have the subject in their taught set.
async function assertCanAuthor(subjectId: string) {
  const user = await requireRole(["tutor", "admin"]);
  const role = coarseRole(user.app_metadata?.role as UserRole);
  if (role !== "admin") {
    const taught = await taughtSubjectIds(user.id);
    if (!taught.includes(subjectId)) throw new Error("Forbidden");
  }
  return user;
}

// ---------------------------------------------------------------------------
// addResource
// ---------------------------------------------------------------------------

const addSchema = z.object({
  subjectId: z.string().uuid(),
  type: z.enum(TYPES),
  topicId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  kind: z.enum(["file", "link"]),
  externalUrl: z.string().max(2000).optional(),
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
  const actor = { id: user.id, role: user.app_metadata?.role as string };

  let fileCols: Record<string, unknown> = {};
  if (parsed.kind === "link") {
    if (!parsed.externalUrl || !httpHref(parsed.externalUrl)) {
      return { ok: false as const, error: "Invalid link" };
    }
    fileCols = { externalUrl: parsed.externalUrl };
  } else {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false as const, error: "No file" };
    }
    const up = await uploadResourceFile(parsed.subjectId, file);
    if (!up.ok) return up;
    fileCols = {
      storageBucket: up.value.bucket,
      storagePath: up.value.path,
      contentType: up.value.contentType,
      sizeBytes: up.value.sizeBytes,
    };
  }

  await withActor(actor, (tx) =>
    tx.insert(resources).values({
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

// ---------------------------------------------------------------------------
// promoteAttachment
// ---------------------------------------------------------------------------

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

  // Auth before DB read - rejects unauthenticated/wrong-role callers before any probe.
  await requireRole(["tutor", "admin"]);

  // Attachments have no subjectId column; derive it via the week plan's
  // subject week. The class tutor is the only tutor who may publish it.
  const [att] = await db
    .select({
      id: classWeekPlanAttachments.id,
      fileName: classWeekPlanAttachments.fileName,
      kind: classWeekPlanAttachments.kind,
      storagePath: classWeekPlanAttachments.storagePath,
      contentType: classWeekPlanAttachments.contentType,
      url: classWeekPlanAttachments.url,
      subjectId: subjectWeeks.subjectId,
      classTutorId: classes.tutorId,
    })
    .from(classWeekPlanAttachments)
    .innerJoin(classWeekPlans, eq(classWeekPlans.id, classWeekPlanAttachments.planId))
    .innerJoin(classes, eq(classes.id, classWeekPlans.classId))
    .innerJoin(subjectWeeks, eq(subjectWeeks.id, classWeekPlans.subjectWeekId))
    .where(eq(classWeekPlanAttachments.id, parsed.attachmentId))
    .limit(1);

  if (!att) return { ok: false as const, error: "Attachment not found" };

  const user = await assertCanAuthor(att.subjectId);
  if (
    coarseRole(user.app_metadata?.role as UserRole) !== "admin" &&
    att.classTutorId !== user.id
  ) {
    return { ok: false as const, error: "Attachment not found" };
  }
  const actor = { id: user.id, role: user.app_metadata?.role as string };

  // Idempotent: if a live promoted resources row already references this attachment, no-op.
  const [existing] = await db
    .select({ id: resources.id })
    .from(resources)
    .where(and(eq(resources.sourceAttachmentId, att.id), isNull(resources.removedAt)))
    .limit(1);
  if (existing) return { ok: true as const };

  let kindCols:
    | { kind: "file"; storageBucket: string; storagePath: string; contentType: string | null }
    | { kind: "link"; externalUrl: string };
  if (att.kind === "file") {
    if (!att.storagePath) return { ok: false as const, error: "Attachment has no file to promote" };
    kindCols = {
      kind: "file" as const,
      storageBucket: "curriculum",
      storagePath: att.storagePath,
      contentType: att.contentType ?? null,
    };
  } else {
    // link (or any future non-file kind)
    if (!att.url) return { ok: false as const, error: "Attachment has no link to promote" };
    kindCols = {
      kind: "link" as const,
      externalUrl: att.url,
    };
  }

  await withActor(actor, (tx) =>
    tx.insert(resources).values({
      subjectId: att.subjectId,
      type: parsed.type,
      topicId: parsed.topicId ?? null,
      title: att.fileName,
      uploadedBy: user.id,
      sourceAttachmentId: att.id,
      ...kindCols,
    }),
  );
  revalidatePath("/tutor/resources");
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// setResourcePublished
// ---------------------------------------------------------------------------

const idSchema = z.object({ id: z.string().uuid() });

export async function setResourcePublished(formData: FormData) {
  const { id } = idSchema.parse({ id: formData.get("id") });
  const published = formData.get("published") === "true";

  // Auth before DB read - rejects unauthenticated/wrong-role callers before any probe.
  await requireRole(["tutor", "admin"]);

  const [row] = await db
    .select({ subjectId: resources.subjectId })
    .from(resources)
    .where(eq(resources.id, id))
    .limit(1);
  if (!row) return { ok: false as const, error: "Not found" };

  const user = await assertCanAuthor(row.subjectId);
  const actor = { id: user.id, role: user.app_metadata?.role as string };

  await withActor(actor, (tx) =>
    tx.update(resources).set({ isPublished: published }).where(eq(resources.id, id)),
  );
  revalidatePath("/tutor/resources");
  revalidatePath("/admin/resources");
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// removeResource  (admin only)
// ---------------------------------------------------------------------------

const removeSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

export async function removeResource(formData: FormData) {
  const parsed = removeSchema.parse({
    id: formData.get("id"),
    reason: formData.get("reason") || undefined,
  });
  const user = await requireRole("admin");
  const actor = { id: user.id, role: user.app_metadata?.role as string };

  await withActor(actor, (tx) =>
    tx
      .update(resources)
      .set({
        removedAt: new Date(),
        removedBy: user.id,
        removedReason: parsed.reason ?? null,
      })
      .where(eq(resources.id, parsed.id)),
  );
  revalidatePath("/admin/resources");
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// restoreResource  (admin only)
// ---------------------------------------------------------------------------

export async function restoreResource(formData: FormData) {
  const { id } = idSchema.parse({ id: formData.get("id") });
  const user = await requireRole("admin");
  const actor = { id: user.id, role: user.app_metadata?.role as string };

  await withActor(actor, (tx) =>
    tx
      .update(resources)
      .set({ removedAt: null, removedBy: null, removedReason: null })
      .where(eq(resources.id, id)),
  );
  revalidatePath("/admin/resources");
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// openResourceFile  (every role - re-authorizes before signing)
// ---------------------------------------------------------------------------

export type OpenedResourceFile =
  | {
      ok: true;
      url: string;
      downloadUrl: string;
      kind: ViewableFileKind;
      format: string | null;
      /** An Office file over the web viewer's size limit: Download only. */
      tooLarge: boolean;
      /** A student's PDF or picture, opened in the writing viewer to take notes on. */
      writable: "pdf" | "image" | null;
    }
  | { ok: false; error: string };

/**
 * The resource row a signed-in user may open: an admin any (removed ones
 * too, to moderate them), a tutor any not removed in a subject they teach
 * (shared or not), a student or parent a published one in their own or
 * their children's subjects.
 */
async function openableResource(id: string) {
  const user = await requireRole(["admin", "tutor", "student", "parent"]);
  const role = coarseRole(user.app_metadata?.role as UserRole);
  if (role === "admin") {
    const [row] = await db.select().from(resources).where(eq(resources.id, id)).limit(1);
    return { role, row: row ?? null };
  }
  if (role === "tutor") {
    return {
      role,
      row: await getResourceForViewer(id, await taughtSubjectIds(user.id), { includeUnpublished: true }),
    };
  }
  const subjectIds =
    role === "student" ? await enrolledSubjectIds(user.id) : await childSubjectIds(user.id);
  return { role, row: await getResourceForViewer(id, subjectIds) };
}

/**
 * Signs one uploaded resource for the portal's viewer, and again as a
 * download under a readable name. Links never come here: the page already
 * has their address.
 */
export async function openResourceFile(id: string): Promise<OpenedResourceFile> {
  const parsed = idSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: "Not found" };
  const { role, row } = await openableResource(parsed.data.id);
  if (!row || row.kind !== "file" || !row.storageBucket || !row.storagePath) {
    return { ok: false, error: "Not found" };
  }
  const [url, downloadUrl] = await Promise.all([
    signResourceAttachment(row.storageBucket, row.storagePath),
    signResourceAttachment(row.storageBucket, row.storagePath, {
      download: resourceDownloadName(row),
    }),
  ]);
  if (!url || !downloadUrl) return { ok: false, error: "Could not open" };
  const kind = viewableFileKind(row.storagePath, row.contentType);
  const tooLarge = kind === "office" && !officePreviewFits(row.storagePath, row.contentType, row.sizeBytes);
  return {
    ok: true,
    url,
    downloadUrl,
    kind: tooLarge ? "other" : kind,
    format: resourceFormat(row),
    tooLarge,
    writable: role === "student" ? writableKind(markupFileKind(row.storagePath, row.contentType)) : null,
  };
}

function writableKind(kind: ReturnType<typeof markupFileKind>): "pdf" | "image" | null {
  return kind === "pdf" ? "pdf" : kind ? "image" : null;
}
