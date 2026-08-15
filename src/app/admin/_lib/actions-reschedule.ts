"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gt, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  attendance,
  familyLinks,
  lessons,
  notifications,
  profiles,
} from "@/db/schema";
import { formatDateLong, formatTime } from "@/lib/format";
import { requireAdmin } from "./guard";
import { getLessonContextForStudent } from "./queries";

const slotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Availability times come through as HH:MM or HH:MM:SS (postgres `time`).
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  tutorId: z.string().uuid(),
});

function parseSlot(raw: string) {
  const parts = raw.split("|");
  if (parts.length !== 4) return null;
  const [date, startTime, endTime, tutorId] = parts;
  const parsed = slotSchema.safeParse({ date, startTime, endTime, tutorId });
  return parsed.success ? parsed.data : null;
}

/**
 * Admin-initiated one-off reschedule of a single student's attendance.
 *
 * Writes:
 *   1. New `lessons` row: same classId, picked tutor/date/time, status="makeup",
 *      rescheduledFrom=originalLessonId.
 *   2. Attendance row on the original lesson: studentId → "absent" (no
 *      "rescheduled" attendance status exists - absent is the closest fit).
 *   3. Attendance row on the new lesson: studentId → "makeup_attended".
 *   4. Notifications to: original tutor, new tutor (if different), and
 *      every linked parent of the student.
 *
 * The original lesson itself is NOT mutated - other enrolled students still
 * attend it normally.
 */
export async function rescheduleStudentLesson(formData: FormData) {
  const admin = await requireAdmin();
  const studentId = String(formData.get("studentId") ?? "");
  const lessonId = String(formData.get("lessonId") ?? "");
  const slotRaw = String(formData.get("slot") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!studentId || !lessonId || reason.length > 2000) {
    redirect(`/admin/users/${studentId}?reschedule=error`);
  }

  const slot = parseSlot(slotRaw);
  if (!slot) {
    redirect(
      `/admin/users/${studentId}/reschedule/${lessonId}?error=invalid-slot`,
    );
  }

  const original = await getLessonContextForStudent(studentId, lessonId);
  if (!original) {
    redirect(`/admin/users/${studentId}?reschedule=error`);
  }

  // Sanity: don't reschedule a lesson that's already happened
  const lessonStart = new Date(`${original.date}T${original.startTime}`);
  if (lessonStart < new Date()) {
    redirect(
      `/admin/users/${studentId}/reschedule/${lessonId}?error=lesson-past`,
    );
  }

  // Don't double-book the tutor: reject if they already have a lesson
  // overlapping the picked slot.
  const clash = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(
      and(
        eq(lessons.tutorId, slot.tutorId),
        eq(lessons.date, slot.date),
        lt(lessons.startTime, slot.endTime),
        gt(lessons.endTime, slot.startTime),
      ),
    )
    .limit(1);
  if (clash.length) {
    redirect(
      `/admin/users/${studentId}/reschedule/${lessonId}?error=slot-taken`,
    );
  }

  // 1. Create the makeup lesson
  const [newLesson] = await db
    .insert(lessons)
    .values({
      classId: original.classId,
      tutorId: slot.tutorId,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: "makeup",
      rescheduledFrom: original.id,
    })
    .returning({ id: lessons.id });

  // 2. Mark student absent on the original lesson
  await db
    .insert(attendance)
    .values({
      lessonId: original.id,
      studentId,
      status: "absent",
      note: reason ? `Rescheduled by admin: ${reason}` : "Rescheduled by admin",
      markedBy: admin.id,
    })
    .onConflictDoUpdate({
      target: [attendance.lessonId, attendance.studentId],
      set: {
        status: "absent",
        note: reason
          ? `Rescheduled by admin: ${reason}`
          : "Rescheduled by admin",
        markedBy: admin.id,
        markedAt: new Date(),
      },
    });

  // 3. Pre-mark student as makeup-attendee on the new lesson
  await db.insert(attendance).values({
    lessonId: newLesson.id,
    studentId,
    status: "makeup_attended",
    note: reason ? `Make-up: ${reason}` : "Make-up scheduled by admin",
    markedBy: admin.id,
  });

  // 4. Notifications
  const [student] = await db
    .select({ firstName: profiles.firstName, lastName: profiles.lastName })
    .from(profiles)
    .where(eq(profiles.id, studentId))
    .limit(1);

  const [newTutor] = await db
    .select({ firstName: profiles.firstName, lastName: profiles.lastName })
    .from(profiles)
    .where(eq(profiles.id, slot.tutorId))
    .limit(1);

  const studentName = student
    ? `${student.firstName} ${student.lastName}`.trim()
    : "A student";
  const newTutorName = newTutor
    ? `${newTutor.firstName} ${newTutor.lastName}`.trim()
    : "another tutor";

  const recipients = new Set<string>();
  recipients.add(original.tutorId);
  if (slot.tutorId !== original.tutorId) recipients.add(slot.tutorId);

  const parents = await db
    .select({ id: familyLinks.parentId })
    .from(familyLinks)
    .where(eq(familyLinks.studentId, studentId));
  for (const p of parents) recipients.add(p.id);

  const body =
    `${studentName}'s ${original.subjectName} lesson on ` +
    `${formatDateLong(original.date)} at ${formatTime(original.startTime)} ` +
    `→ moved to ${formatDateLong(slot.date)} ` +
    `${formatTime(slot.startTime)}–${formatTime(slot.endTime)} ` +
    `with ${newTutorName}.` +
    (reason ? ` Reason: ${reason}` : "");

  if (recipients.size > 0) {
    await db.insert(notifications).values(
      Array.from(recipients).map((userId) => ({
        userId,
        channel: "in_app" as const,
        title: `Lesson rescheduled`,
        body,
        href: `/admin/users/${studentId}`,
      })),
    );
  }

  revalidatePath(`/admin/users/${studentId}`);
  revalidatePath("/admin/attendance");
  revalidatePath(`/tutor/lessons/${newLesson.id}`);

  redirect(`/admin/users/${studentId}?reschedule=ok`);
}
