"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createAdminClient } from "@/app/admin/_lib/supabase-admin";
import { db } from "@/db/client";
import { homework } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import {
  createDirectUploadGrant,
  discardDirectUpload,
  finalizeDirectUpload,
} from "@/lib/direct-upload";
import { coarseRole } from "@/lib/roles";
import { HOMEWORK_POLICY, validateUploadMetadata } from "@/lib/upload-validation";

const HOMEWORK_ATTACHMENT_BUCKET = "homework-attachments";
const HOMEWORK_SOLUTION_UPLOAD_PURPOSE = "homework-solution";

const solutionFileSchema = z.object({
  homeworkId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(200),
  sizeBytes: z.number().int().positive(),
});

async function requireSolutionManager(homeworkId: string) {
  const user = await requireRole(["tutor", "admin"]);
  const role = coarseRole(user.app_metadata.role);
  const [row] = await db
    .select({
      id: homework.id,
      tutorId: homework.tutorId,
      classId: homework.classId,
      solutionUrl: homework.solutionUrl,
    })
    .from(homework)
    .where(
      role === "admin"
        ? eq(homework.id, homeworkId)
        : and(eq(homework.id, homeworkId), eq(homework.tutorId, user.id)),
    )
    .limit(1);
  if (!row) throw new Error("Homework not found");
  return { user, role, homework: row };
}

export async function prepareHomeworkSolutionUpload(input: {
  homeworkId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}) {
  const parsed = solutionFileSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };
  const { user } = await requireSolutionManager(parsed.data.homeworkId);

  const validated = validateUploadMetadata(
    { size: parsed.data.sizeBytes, type: parsed.data.contentType },
    HOMEWORK_POLICY,
  );
  if (!validated.ok) return validated;

  return createDirectUploadGrant({
    purpose: HOMEWORK_SOLUTION_UPLOAD_PURPOSE,
    userId: user.id,
    scope: parsed.data.homeworkId,
    bucket: HOMEWORK_ATTACHMENT_BUCKET,
    path: `solutions/${parsed.data.homeworkId}/${Date.now()}-${randomUUID()}.${validated.file.ext}`,
    fileName: parsed.data.fileName,
    sizeBytes: parsed.data.sizeBytes,
    contentType: parsed.data.contentType,
    policy: HOMEWORK_POLICY,
  });
}

export async function updateHomeworkSolution(input: {
  homeworkId: string;
  uploadTicket?: string;
  remove?: boolean;
}) {
  const parsed = z
    .object({
      homeworkId: z.string().uuid(),
      uploadTicket: z.string().optional(),
      remove: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };
  if (!parsed.data.uploadTicket && !parsed.data.remove) {
    return { ok: false as const, error: "Choose a solution file" };
  }

  const { user, homework: existing } = await requireSolutionManager(
    parsed.data.homeworkId,
  );
  let solutionUrl = existing.solutionUrl;

  if (parsed.data.uploadTicket) {
    const verified = await finalizeDirectUpload({
      ticket: parsed.data.uploadTicket,
      expectedPurpose: HOMEWORK_SOLUTION_UPLOAD_PURPOSE,
      expectedUserId: user.id,
      expectedScope: parsed.data.homeworkId,
      policy: HOMEWORK_POLICY,
    });
    if (!verified.ok) return verified;
    solutionUrl = verified.value.path;
  } else if (parsed.data.remove) {
    solutionUrl = null;
  }

  try {
    await db
      .update(homework)
      .set({ solutionUrl })
      .where(eq(homework.id, parsed.data.homeworkId));
  } catch (error) {
    if (parsed.data.uploadTicket) {
      await discardDirectUpload(parsed.data.uploadTicket);
    }
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Solution could not be saved",
    };
  }

  const oldPath = existing.solutionUrl;
  if (oldPath && oldPath !== solutionUrl && !oldPath.startsWith("http")) {
    try {
      await createAdminClient()
        .storage.from(HOMEWORK_ATTACHMENT_BUCKET)
        .remove([oldPath]);
    } catch (error) {
      console.error("homework solution cleanup failed", error);
    }
  }

  revalidatePath(`/tutor/homework/${parsed.data.homeworkId}`);
  revalidatePath("/tutor/homework");
  revalidatePath("/student/homework");
  if (existing.classId) {
    revalidatePath(`/tutor/classes/${existing.classId}/curriculum`);
  }
  revalidatePath("/admin/classes");

  return { ok: true as const };
}
