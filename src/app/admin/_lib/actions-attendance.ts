"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { attendance, attendanceStatusEnum } from "@/db/schema";
import { requireAdmin } from "./guard";

const statusSchema = z.enum(attendanceStatusEnum.enumValues);

export async function adminSaveAttendance(formData: FormData) {
  const admin = await requireAdmin();
  const lessonId = String(formData.get("lessonId") ?? "");
  if (!lessonId) throw new Error("Missing lessonId");

  const entries: { studentId: string; status: string; note: string }[] = [];
  for (const [key, value] of formData.entries()) {
    const match = key.match(/^status\[(.+)\]$/);
    if (!match) continue;
    const studentId = match[1];
    const status = String(value ?? "");
    if (!status) continue;
    const note = String(formData.get(`note[${studentId}]`) ?? "");
    entries.push({ studentId, status, note });
  }

  for (const entry of entries) {
    const parsed = statusSchema.safeParse(entry.status);
    if (!parsed.success) continue;
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
