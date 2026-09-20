"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gt, inArray, isNull, lt, ne, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  attendance,
  enrollments,
  familyLinks,
  lessons,
  notifications,
  profiles,
  rescheduleRequests,
} from "@/db/schema";
import { formatDateLong, formatTime } from "@/lib/format";
import {
  expandAvailability,
  getAllTutors,
  getEligibleTutors,
  markTakenSlots,
  type AvailableSlot,
} from "@/lib/availability";
import { requireAdmin } from "./guard";
import { getLessonContextForStudent } from "./queries";
import { ADMIN_TIERS } from "@/lib/roles";

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
 * Records the move, exact-lesson attendance, and role-appropriate inbox
 * notices together. An earlier approved move of this student's same lesson
 * is superseded without changing any other enrolled student's attendance.
 *
 * The original lesson itself is NOT mutated - other enrolled students still
 * attend it normally.
 */
export async function rescheduleStudentLesson(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  const studentId = String(formData.get("studentId") ?? "");
  const lessonId = String(formData.get("lessonId") ?? "");
  const slotRaw = String(formData.get("slot") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!z.string().uuid().safeParse(studentId).success ||
      !z.string().uuid().safeParse(lessonId).success || reason.length > 2000) {
    return { ok: false, error: "Missing lesson details." };
  }

  const slot = parseSlot(slotRaw);
  if (!slot) {
    return { ok: false, error: "That slot is no longer valid." };
  }

  const original = await getLessonContextForStudent(studentId, lessonId);
  if (!original) {
    return { ok: false, error: "Missing lesson details." };
  }

  if (original.status !== "upcoming" || original.rescheduledFrom) {
    return { ok: false, error: "Only an upcoming original lesson can be moved." };
  }

  const lessonStart = new Date(`${original.date}T${original.startTime}`);
  if (lessonStart <= new Date()) {
    return { ok: false, error: "That lesson has already happened." };
  }

  // Never trust a slot string submitted by the browser: check it against the
  // current availability picker as well as against bookings in the transaction.
  const options = await loadAdminRescheduleOptions(studentId, lessonId);
  if (!options.ok) return options;
  const offered = [...options.sameSubject, ...options.allTutors].some(
    (candidate) => !candidate.taken &&
      candidate.date === slot.date &&
      candidate.startTime === slot.startTime &&
      candidate.endTime === slot.endTime &&
      candidate.tutorId === slot.tutorId,
  );
  if (!offered) {
    return { ok: false, error: "That availability is no longer open. Pick another slot." };
  }

  const [student, newTutor, parents, admins] = await Promise.all([
    db.select({ firstName: profiles.firstName, lastName: profiles.lastName })
      .from(profiles).where(eq(profiles.id, studentId)).limit(1),
    db.select({ firstName: profiles.firstName, lastName: profiles.lastName })
      .from(profiles).where(eq(profiles.id, slot.tutorId)).limit(1),
    db.select({ id: familyLinks.parentId }).from(familyLinks)
      .where(eq(familyLinks.studentId, studentId)),
    db.select({ id: profiles.id }).from(profiles)
      .where(and(inArray(profiles.role, ADMIN_TIERS), eq(profiles.isActive, true))),
  ]);

  const studentName = student[0]
    ? `${student[0].firstName} ${student[0].lastName}`.trim()
    : "A student";
  const newTutorName = newTutor[0]
    ? `${newTutor[0].firstName} ${newTutor[0].lastName}`.trim()
    : "another tutor";

  const body =
    `${studentName}'s ${original.subjectName} lesson on ` +
    `${formatDateLong(original.date)} at ${formatTime(original.startTime)} ` +
    `→ moved to ${formatDateLong(slot.date)} ` +
    `${formatTime(slot.startTime)}–${formatTime(slot.endTime)} ` +
    `with ${newTutorName}.` +
    (reason ? ` Reason: ${reason}` : "");

  const outcome = await db.transaction(async (tx) => {
    // Serialize changes to this student's original lesson, then reservations
    // for the chosen tutor/date, before rechecking the live booking state.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`makeup:${studentId}:${lessonId}`}))`);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`makeup-tutor:${slot.tutorId}:${slot.date}`}))`);

    const [liveOriginal] = await tx.select({
      status: lessons.status,
      date: lessons.date,
      startTime: lessons.startTime,
      rescheduledFrom: lessons.rescheduledFrom,
    }).from(lessons).where(eq(lessons.id, original.id)).limit(1);
    const [enrolled] = await tx.select({ id: enrollments.studentId })
      .from(enrollments).where(and(
        eq(enrollments.classId, original.classId),
        eq(enrollments.studentId, studentId),
        isNull(enrollments.withdrawnAt),
      )).limit(1);
    if (!liveOriginal || liveOriginal.status !== "upcoming" ||
        !enrolled || liveOriginal.rescheduledFrom ||
        new Date(`${liveOriginal.date}T${liveOriginal.startTime}`) <= new Date()) {
      return { ok: false as const, error: "That original lesson is no longer upcoming." };
    }

    const clash = await tx.select({ id: lessons.id }).from(lessons).where(and(
      eq(lessons.tutorId, slot.tutorId),
      eq(lessons.date, slot.date),
      lt(lessons.startTime, slot.endTime),
      gt(lessons.endTime, slot.startTime),
      ne(lessons.status, "cancelled"),
      ne(lessons.status, "rescheduled"),
    )).limit(1);
    if (clash.length) {
      return { ok: false as const, error: "Someone just took that slot. Pick another." };
    }

    const prior = await tx.select({
      id: rescheduleRequests.id,
      targetLessonId: rescheduleRequests.targetLessonId,
      requestedById: rescheduleRequests.requestedById,
    }).from(rescheduleRequests).where(and(
      eq(rescheduleRequests.studentId, studentId),
      eq(rescheduleRequests.originalLessonId, original.id),
      eq(rescheduleRequests.status, "approved"),
    ));
    const priorRequesterIds = prior.map((move) => move.requestedById);
    const [priorSelfServeRequester] = priorRequesterIds.length
      ? await tx.select({ id: profiles.id }).from(profiles).where(and(
          inArray(profiles.id, priorRequesterIds),
          notInArray(profiles.role, [...ADMIN_TIERS, "admin"]),
        )).limit(1)
      : [];
    for (const move of prior) {
      if (move.targetLessonId) {
        await tx.delete(attendance).where(and(
          eq(attendance.lessonId, move.targetLessonId),
          eq(attendance.studentId, studentId),
        ));
        const [remaining] = await tx.select({ studentId: attendance.studentId })
          .from(attendance).where(eq(attendance.lessonId, move.targetLessonId))
          .limit(1);
        if (!remaining) {
          await tx.update(lessons).set({ status: "cancelled" }).where(and(
            eq(lessons.id, move.targetLessonId),
            eq(lessons.status, "makeup"),
            eq(lessons.rescheduledFrom, original.id),
          ));
        }
      }
    }
    await tx.update(rescheduleRequests).set({ status: "cancelled" }).where(and(
      eq(rescheduleRequests.studentId, studentId),
      eq(rescheduleRequests.originalLessonId, original.id),
      inArray(rescheduleRequests.status, ["approved", "pending"]),
    ));
    await tx.delete(notifications).where(and(
      eq(notifications.href, `/admin/reschedules?r=${studentId}:${original.id}`),
      eq(notifications.title, "Reschedule request"),
    ));

    const [newLesson] = await tx.insert(lessons).values({
      classId: original.classId,
      tutorId: slot.tutorId,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: "makeup",
      rescheduledFrom: original.id,
    }).returning({ id: lessons.id });

    await tx.insert(attendance).values({
      lessonId: original.id,
      studentId,
      status: "absent",
      note: reason ? `Rescheduled by admin: ${reason}` : "Rescheduled by admin",
      markedBy: admin.id,
    }).onConflictDoUpdate({
      target: [attendance.lessonId, attendance.studentId],
      set: {
        status: "absent",
        note: reason ? `Rescheduled by admin: ${reason}` : "Rescheduled by admin",
        markedBy: admin.id,
        markedAt: new Date(),
      },
    });
    await tx.insert(attendance).values({
      lessonId: newLesson.id,
      studentId,
      status: "makeup_attended",
      note: reason ? `Make-up: ${reason}` : "Make-up scheduled by admin",
      markedBy: admin.id,
    });
    await tx.insert(rescheduleRequests).values({
      originalLessonId: original.id,
      studentId,
      requestedById: priorSelfServeRequester?.id ?? admin.id,
      reason: reason || null,
      status: "approved",
      targetTutorId: slot.tutorId,
      targetDate: slot.date,
      targetStartTime: slot.startTime,
      targetEndTime: slot.endTime,
      targetLessonId: newLesson.id,
      decidedById: admin.id,
      decidedAt: new Date(),
    });

    const recipients = new Map<string, string>([
      [studentId, "/student/timetable"],
      [original.tutorId, `/tutor/lessons/${original.id}`],
      [slot.tutorId, `/tutor/lessons/${newLesson.id}`],
    ]);
    for (const parent of parents) recipients.set(parent.id, "/parent/classes");
    for (const owner of admins) recipients.set(owner.id, `/admin/users/${studentId}`);
    await tx.insert(notifications).values(Array.from(recipients, ([userId, href]) => ({
      userId,
      channel: "in_app" as const,
      title: "Lesson rescheduled",
      body,
      href,
    })));
    return { ok: true as const, lessonId: newLesson.id };
  });
  if (!outcome.ok) return outcome;

  revalidatePath(`/admin/users/${studentId}`);
  revalidatePath("/admin/attendance");
  revalidatePath(`/tutor/lessons/${outcome.lessonId}`);
  revalidatePath(`/tutor/lessons/${original.id}`);
  revalidatePath("/student/timetable");
  revalidatePath("/parent/classes");

  return { ok: true };
}

/**
 * Slots an admin may move a lesson into. An admin can select a tutor outside
 * the lesson's subject roster, so both the default and override lists are
 * returned together.
 */
export async function loadAdminRescheduleOptions(
  studentId: string,
  lessonId: string,
): Promise<
  | { ok: true; sameSubject: AvailableSlot[]; allTutors: AvailableSlot[] }
  | { ok: false; error: string }
> {
  await requireAdmin();
  const lesson = await getLessonContextForStudent(studentId, lessonId);
  if (!lesson) return { ok: false, error: "Lesson not found." };

  const now = new Date();
  const [sameSubjectTutors, allTutors] = await Promise.all([
    getEligibleTutors(lesson.classId),
    getAllTutors(lesson.tutorId),
  ]);
  const [sameSubjectSlots, allTutorSlots] = await Promise.all([
    expandAvailability(sameSubjectTutors, now, 4),
    expandAvailability(allTutors, now, 4),
  ]);
  const [sameSubject, allTutorsMarked] = await Promise.all([
    markTakenSlots(sameSubjectSlots),
    markTakenSlots(allTutorSlots),
  ]);

  return { ok: true, sameSubject, allTutors: allTutorsMarked };
}
