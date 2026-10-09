"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  homework,
  homeworkAssignments,
  subjectWeeks,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import {
  createDirectUploadGrant,
  discardDirectUpload,
  finalizeDirectUpload,
} from "@/lib/direct-upload";
import { HOMEWORK_POLICY, validateUploadMetadata } from "@/lib/upload-validation";
import { optionalText, requiredText } from "@/lib/validation";
import { withActor } from "@/lib/with-actor";

const HOMEWORK_BUCKET = "homework-attachments";
const ADMIN_HOMEWORK_UPLOAD_PURPOSE = "admin-homework-attachment";

const directFileSchema = z.object({
  classId: z.union([z.string().uuid(), z.literal("")]).optional(),
  subjectWeekId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(200),
  sizeBytes: z.number().int().positive(),
});

async function getHomeworkTarget(classId: string | null, subjectWeekId: string) {
  const [week] = await db
    .select({
      subjectId: subjectWeeks.subjectId,
    })
    .from(subjectWeeks)
    .where(eq(subjectWeeks.id, subjectWeekId))
    .limit(1);
  if (!week) throw new Error("Curriculum week not found");

  if (!classId) {
    return { classId: null, tutorId: null, subjectId: week.subjectId };
  }

  const [target] = await db
    .select({
      classId: classes.id,
      tutorId: classes.tutorId,
      subjectId: classes.subjectId,
    })
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);
  if (!target || target.subjectId !== week.subjectId) {
    throw new Error("Choose a class for this subject");
  }
  return target;
}

export async function prepareAdminHomeworkAttachmentUpload(input: {
  classId: string;
  subjectWeekId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}) {
  const admin = await requireRole("admin");
  const parsed = directFileSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };
  await getHomeworkTarget(
    parsed.data.classId || null,
    parsed.data.subjectWeekId,
  );

  const validated = validateUploadMetadata(
    { size: parsed.data.sizeBytes, type: parsed.data.contentType },
    HOMEWORK_POLICY,
  );
  if (!validated.ok) return validated;

  return createDirectUploadGrant({
    purpose: ADMIN_HOMEWORK_UPLOAD_PURPOSE,
    userId: admin.id,
    scope: `${parsed.data.classId || "subject"}:${parsed.data.subjectWeekId}`,
    bucket: HOMEWORK_BUCKET,
    path: `${admin.id}/${Date.now()}-${randomUUID()}.${validated.file.ext}`,
    fileName: parsed.data.fileName,
    sizeBytes: parsed.data.sizeBytes,
    contentType: parsed.data.contentType,
    policy: HOMEWORK_POLICY,
  });
}

export async function createAdminHomework(formData: FormData) {
  const admin = await requireRole("admin");
  const title = requiredText(formData.get("title"), 200, "Title");
  const description = optionalText(formData.get("description"), 5000);
  const dueDateRaw = String(formData.get("dueDate") ?? "");
  const classId = String(formData.get("classId") ?? "") || null;
  const weekId = String(formData.get("weekId") ?? "");
  const allowResubmission = formData.get("allowResubmission") === "on";
  const isTest = formData.get("isTest") === "on";
  if (!weekId) throw new Error("Curriculum week is required");
  if (!dueDateRaw) throw new Error("Due date required");
  const dueDate = new Date(dueDateRaw);
  if (Number.isNaN(dueDate.getTime())) throw new Error("Invalid due date");

  const target = await getHomeworkTarget(classId, weekId);
  let attachmentUrl: string | null = null;
  const uploadTicket = String(formData.get("uploadTicket") ?? "");
  if (uploadTicket) {
    const verified = await finalizeDirectUpload({
      ticket: uploadTicket,
      expectedPurpose: ADMIN_HOMEWORK_UPLOAD_PURPOSE,
      expectedUserId: admin.id,
      expectedScope: `${classId ?? "subject"}:${weekId}`,
      policy: HOMEWORK_POLICY,
    });
    if (!verified.ok) throw new Error(verified.error);
    attachmentUrl = verified.value.path;
  }

  try {
    const created = await withActor(
      { id: admin.id, role: String(admin.app_metadata.role) },
      async (tx) => {
        const [row] = await tx
          .insert(homework)
          .values({
            tutorId: target.tutorId,
            createdById: admin.id,
            classId,
            title,
            description: description || null,
            dueDate,
            attachmentUrl,
            allowResubmission,
            isTest,
            weekId,
          })
          .returning({ id: homework.id });

        if (classId) {
          const students = await tx
            .select({ studentId: enrollments.studentId })
            .from(enrollments)
            .where(
              and(
                eq(enrollments.classId, classId),
                isNull(enrollments.withdrawnAt),
              ),
            );
          if (students.length > 0) {
            await tx
              .insert(homeworkAssignments)
              .values(
                students.map(({ studentId }) => ({
                  homeworkId: row.id,
                  studentId,
                  status: "not_started" as const,
                })),
              )
              .onConflictDoNothing();
          }
        }
        return row;
      },
    );

    revalidatePath(`/admin/subjects/${target.subjectId}/curriculum`);
    if (classId) {
      revalidatePath(`/tutor/classes/${classId}/curriculum`);
    }
    revalidatePath("/tutor/homework");
    revalidatePath("/student/homework");
    return { ok: true as const, id: created.id };
  } catch (error) {
    if (uploadTicket) await discardDirectUpload(uploadTicket);
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Homework could not be created",
    };
  }
}
