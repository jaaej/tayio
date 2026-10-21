"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attendance, lessons } from "@/db/schema";
import { ROLL_STATUSES } from "@/lib/attendance-roll";
import { lessonRollIds } from "@/lib/lesson-roll";
import { optionalText } from "@/lib/validation";
import { withActor } from "@/lib/with-actor";
import { requireAdmin } from "./guard";
import { lessonDeletionImpact } from "./class-lessons";

const statusSchema = z.enum(ROLL_STATUSES);

export async function adminSaveAttendance(formData: FormData) {
  const admin = await requireAdmin();
  const lessonId = z.string().uuid().parse(formData.get("lessonId"));

  const entries: { studentId: string; status: string; note: string | null }[] = [];
  for (const [key, value] of formData.entries()) {
    const match = key.match(/^status\[(.+)\]$/);
    if (!match) continue;
    const studentId = match[1];
    const status = String(value ?? "");
    if (!status) continue;
    const note = optionalText(formData.get(`note[${studentId}]`), 2000);
    entries.push({ studentId, status, note });
  }

  const [lesson] = await db
    .select({ id: lessons.id, classId: lessons.classId, status: lessons.status })
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lesson) throw new Error("Lesson not found");
  const allowedStudentIds = await lessonRollIds(lesson);

  for (const entry of entries) {
    const parsed = statusSchema.safeParse(entry.status);
    if (!parsed.success) continue;
    if (!allowedStudentIds.has(entry.studentId)) {
      throw new Error("Student is not on this lesson's roll");
    }
    await db
      .insert(attendance)
      .values({
        lessonId,
        studentId: entry.studentId,
        status: parsed.data,
        note: entry.note || null,
        markedBy: admin.id,
      })
      .onConflictDoUpdate({
        target: [attendance.lessonId, attendance.studentId],
        set: {
          status: parsed.data,
          note: entry.note || null,
          markedBy: admin.id,
          markedAt: new Date(),
        },
      });
  }

  revalidatePath(`/admin/attendance/${lessonId}`);
  revalidatePath("/admin/attendance");
  revalidatePath("/admin");
}

/**
 * What deleting a lesson would remove, for its confirmation. Only a lesson
 * that has started can be deleted (a future weekly one would be made again).
 */
export async function getLessonDeletionImpact(lessonId: string) {
  await requireAdmin();
  z.string().uuid().parse(lessonId);
  const impact = await db.transaction((tx) => lessonDeletionImpact(tx, lessonId, new Date()));
  if (!impact) return { ok: false as const, error: "This lesson no longer exists." };
  return { ok: true as const, impact };
}

/**
 * Delete a lesson that has started, with its attendance, notes and any
 * reschedule or cover requests on it. Homework set in it and tutor hours
 * logged against it stay. This is how a class with history is cleared before
 * the class itself can be deleted.
 */
export async function deleteLesson(lessonId: string) {
  const admin = await requireAdmin();
  z.string().uuid().parse(lessonId);
  const now = new Date();
  const result = await withActor({ id: admin.id, role: "admin" }, async (tx) => {
    const impact = await lessonDeletionImpact(tx, lessonId, now);
    if (!impact) return { ok: false as const, error: "This lesson no longer exists." };
    if (!impact.started) {
      return {
        ok: false as const,
        error: "Only a lesson that has started can be deleted. Change the class to move future lessons.",
      };
    }
    const [deleted] = await tx
      .delete(lessons)
      .where(eq(lessons.id, lessonId))
      .returning({ classId: lessons.classId });
    return { ok: true as const, classId: deleted?.classId ?? null };
  });
  if (result.ok) {
    revalidatePath("/admin/attendance", "layout");
    if (result.classId) revalidatePath(`/admin/classes/${result.classId}`);
    revalidatePath("/admin/classes");
  }
  return result;
}
