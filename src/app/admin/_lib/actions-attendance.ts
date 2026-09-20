"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  attendance,
  attendanceStatusEnum,
  enrollments,
  lessons,
} from "@/db/schema";
import { optionalText } from "@/lib/validation";
import { requireAdmin } from "./guard";

const statusSchema = z.enum(attendanceStatusEnum.enumValues);

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
    .select({ classId: lessons.classId, status: lessons.status })
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lesson) throw new Error("Lesson not found");

  const [regularRows, lessonAttendeeRows] = await Promise.all([
    lesson.status === "makeup"
      ? Promise.resolve([])
      : db
          .select({ studentId: enrollments.studentId })
          .from(enrollments)
          .where(
            and(
              eq(enrollments.classId, lesson.classId),
              isNull(enrollments.withdrawnAt),
            ),
          ),
    db
      .select({ studentId: attendance.studentId })
      .from(attendance)
      .where(eq(attendance.lessonId, lessonId)),
  ]);
  const allowedStudentIds = new Set([
    ...regularRows.map((row) => row.studentId),
    ...lessonAttendeeRows.map((row) => row.studentId),
  ]);

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
