"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { resources, tutorWeekAttachments, tutorWeekSections, subjectWeeks } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { coarseRole } from "@/lib/roles";
import { taughtSubjectIds } from "@/lib/resources";
import { uploadResourceFile } from "@/lib/resources-storage";
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

  // tutorWeekAttachments has no subjectId column; derive via:
  //   tutorWeekAttachments.sectionId → tutorWeekSections.id
  //   tutorWeekSections.subjectWeekId → subjectWeeks.id
  //   subjectWeeks.subjectId
  const [att] = await db
    .select({
      id: tutorWeekAttachments.id,
      fileName: tutorWeekAttachments.fileName,
      storagePath: tutorWeekAttachments.storagePath,
      contentType: tutorWeekAttachments.contentType,
      subjectId: subjectWeeks.subjectId,
    })
    .from(tutorWeekAttachments)
    .innerJoin(tutorWeekSections, eq(tutorWeekSections.id, tutorWeekAttachments.sectionId))
    .innerJoin(subjectWeeks, eq(subjectWeeks.id, tutorWeekSections.subjectWeekId))
    .where(eq(tutorWeekAttachments.id, parsed.attachmentId))
    .limit(1);

  if (!att) return { ok: false as const, error: "Attachment not found" };

  const user = await assertCanAuthor(att.subjectId);
  const actor = { id: user.id, role: user.app_metadata?.role as string };

  // Idempotent: if a live promoted resources row already references this attachment, no-op.
  const [existing] = await db
    .select({ id: resources.id })
    .from(resources)
    .where(and(eq(resources.sourceAttachmentId, att.id), isNull(resources.removedAt)))
    .limit(1);
  if (existing) return { ok: true as const };

  await withActor(actor, (tx) =>
    tx.insert(resources).values({
      subjectId: att.subjectId,
      type: parsed.type,
      topicId: parsed.topicId ?? null,
      kind: "file",
      title: att.fileName,
      storageBucket: "curriculum",
      storagePath: att.storagePath,
      contentType: att.contentType ?? null,
      uploadedBy: user.id,
      sourceAttachmentId: att.id,
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
