"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attendance, classes, familyLinks, lessons, notifications, rescheduleRequests } from "@/db/schema";
import type { UserRole } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { coarseRole } from "@/lib/roles";
import { formatDateLong } from "@/lib/format";
import {
  executeMakeupReschedule,
  getAdminIds,
  getOneOnOneSlots,
  getReschedulableLesson,
  hasPriorReschedule,
  markStudentAbsent,
  recordDirectMakeup,
  studentDisplayName,
  studentOwnsLesson,
  approveRescheduleRequest,
  rejectRescheduleRequest,
} from "@/lib/reschedule";
import {
  getReschedulesUsed,
  getTerms,
  grantCredit,
  hasCreditFromLesson,
  isLessonCancelled,
} from "@/lib/credits";
import {
  meetsRescheduleNotice,
  remaining,
  resolveTerm,
  RESCHEDULE_CAP,
} from "@/lib/reschedule-credits";

type Result = { ok: true; message: string } | { ok: false; error: string };

export type RescheduleSlot = {
  tutorId: string;
  date: string;
  startTime: string;
  endTime: string;
  tutorName: string;
  /** True when the tutor is already booked at this slot - shown as taken
   *  (greyed/struck), not offered. */
  taken?: boolean;
};

export type RescheduleOptions =
  | {
      ok: true;
      /** @deprecated approval retired; always false. UI reads removed in a later task. */
      approvalRequired: boolean;
      /** @deprecated approval retired; always false. UI reads removed in a later task. */
      secondReschedule: boolean;
      hasSlots: boolean;
      lesson: {
        subjectName: string;
        className: string;
        date: string;
        startTime: string;
        endTime: string;
      };
      slots: RescheduleSlot[];
    }
  | { ok: false; error: string };

export async function parentLinked(parentId: string, studentId: string): Promise<boolean> {
  const rows = await db
    .select({ p: familyLinks.parentId })
    .from(familyLinks)
    .where(
      and(
        eq(familyLinks.parentId, parentId),
        eq(familyLinks.studentId, studentId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function resolveStudent(
  user: { id: string },
  role: string,
  studentIdArg: string,
): Promise<string | null> {
  if (role === "parent") {
    if (!studentIdArg || !(await parentLinked(user.id, studentIdArg))) return null;
    return studentIdArg;
  }
  return user.id;
}

/** Is the student already marked absent on this lesson? Mirrors the guard in
 *  `cancelLessonInDb` (src/lib/credits.ts) - a raw "absent" mark (from a
 *  cancellation, a superseded reschedule, or any other reason) means this
 *  lesson has already been dealt with. */
async function isLessonAbsent(lessonId: string, studentId: string): Promise<boolean> {
  const rows = await db
    .select({ lessonId: attendance.lessonId })
    .from(attendance)
    .where(
      and(
        eq(attendance.lessonId, lessonId),
        eq(attendance.studentId, studentId),
        eq(attendance.status, "absent"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Load the reschedule options for a lesson: the tutor's open availability
 * slots. Used by the inline timetable picker.
 */
export async function loadRescheduleOptions(
  lessonId: string,
  studentIdArg?: string,
): Promise<RescheduleOptions> {
  const user = await requireRole(["student_unrestricted", "parent"]);
  const role = coarseRole(user.app_metadata?.role as UserRole);
  const studentId = await resolveStudent(user, role, studentIdArg ?? "");
  if (!studentId) return { ok: false, error: "Not your student." };
  if (!(await studentOwnsLesson(studentId, lessonId))) {
    return { ok: false, error: "That lesson isn't yours." };
  }
  const original = await getReschedulableLesson(lessonId);
  if (!original) return { ok: false, error: "Lesson not found." };
  const now = new Date();
  if (new Date(`${original.date}T${original.startTime}`).getTime() <= now.getTime()) {
    return { ok: false, error: "That lesson has already started." };
  }
  const slots = await getOneOnOneSlots(original, now);
  return {
    ok: true,
    // deprecated: approval retired; UI reads removed in a later task
    approvalRequired: false,
    // deprecated: approval retired; UI reads removed in a later task
    secondReschedule: false,
    hasSlots: slots.length > 0,
    lesson: {
      subjectName: original.subjectName,
      className: original.className,
      date: original.date,
      startTime: original.startTime,
      endTime: original.endTime,
    },
    slots: slots.map((s) => ({
      tutorId: s.tutorId,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      tutorName: s.tutorName,
      taken: s.taken,
    })),
  };
}

/**
 * Student (unrestricted) or parent reschedules a lesson to a tutor-availability
 * slot, gated on 7-day notice and the per-term reschedule cap. Moves the lesson
 * directly - there is no approval step. Slot = "tutorId|date|start|end".
 */
export async function submitReschedule(formData: FormData): Promise<Result> {
  const user = await requireRole(["student_unrestricted", "parent"]);
  const role = coarseRole(user.app_metadata?.role as UserRole);

  const lessonId = String(formData.get("lessonId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 2000);

  const studentId = await resolveStudent(
    user,
    role,
    String(formData.get("studentId") ?? ""),
  );
  if (!studentId) return { ok: false, error: "Not your student." };
  if (!lessonId || !(await studentOwnsLesson(studentId, lessonId))) {
    return { ok: false, error: "That lesson isn't yours to move." };
  }

  const original = await getReschedulableLesson(lessonId);
  if (!original) return { ok: false, error: "Lesson not found." };
  const now = new Date();
  if (new Date(`${original.date}T${original.startTime}`).getTime() <= now.getTime()) {
    return { ok: false, error: "That lesson has already started." };
  }

  const parts = String(formData.get("slot") ?? "").split("|");
  if (parts.length !== 4) return { ok: false, error: "Pick a time first." };
  const [tutorId, date, startTime] = parts;
  if (tutorId !== original.tutorId) {
    return { ok: false, error: "Slot must be with your tutor." };
  }
  const slots = await getOneOnOneSlots(original, now);
  // Never trust the client's endTime - use the matched server slot's, so the
  // clash guard and the inserted lesson's duration are both server-derived.
  const matchedSlot = slots.find(
    (s) => s.tutorId === tutorId && s.date === date && s.startTime === startTime,
  );
  if (!matchedSlot) {
    return { ok: false, error: "That time is no longer available - pick another." };
  }

  const term = resolveTerm(original.date, await getTerms());
  if (!term) {
    return {
      ok: false,
      error: "That lesson is outside a known term - message the office.",
    };
  }
  if (!meetsRescheduleNotice(now, original.date, original.startTime)) {
    return {
      ok: false,
      error: "Reschedules need at least 7 days notice - message the office.",
    };
  }
  if (remaining(RESCHEDULE_CAP, await getReschedulesUsed(studentId, term.id)) <= 0) {
    return {
      ok: false,
      error: "You have used all 3 reschedules this term - message the office.",
    };
  }
  // A cancelled lesson must not also be rescheduled (would double-grant a
  // credit while also creating a real makeup). An already-moved lesson stays
  // reschedulable - `executeMakeupReschedule` supersedes the prior move.
  if (await isLessonCancelled(lessonId, studentId)) {
    return {
      ok: false,
      error: "That lesson has already been cancelled - message the office.",
    };
  }
  // A lesson already converted to a class credit (no-slot reschedule credit)
  // must not also be rescheduled into a real makeup - that would keep the
  // still-active credit while also handing the student a real replacement
  // lesson.
  if (await hasCreditFromLesson(studentId, lessonId)) {
    return {
      ok: false,
      error: "That lesson has already been converted to a class credit - message the office.",
    };
  }

  const done = () => {
    revalidatePath("/student/timetable");
    revalidatePath("/parent/classes");
    revalidatePath("/admin/attendance");
  };

  const res = await executeMakeupReschedule({
    studentId,
    originalLessonId: lessonId,
    tutorId,
    date,
    startTime,
    endTime: matchedSlot.endTime,
    reason,
    actorId: user.id,
  });
  if (!res.ok) return res;
  await recordDirectMakeup({
    studentId,
    requestedById: user.id,
    originalLessonId: lessonId,
    makeupLessonId: res.lessonId,
    tutorId,
    date,
    startTime,
    endTime: matchedSlot.endTime,
    reason,
  });
  done();
  return { ok: true, message: "Lesson moved." };
}

/**
 * No 1-on-1 slot is available with the tutor - grant a class credit instead of
 * moving the lesson. Same 7-day notice + per-term cap gates as submitReschedule
 * (the credit counts as one reschedule use).
 */
export async function grantRescheduleCredit(formData: FormData): Promise<Result> {
  const user = await requireRole(["student_unrestricted", "parent"]);
  const role = coarseRole(user.app_metadata?.role as UserRole);

  const lessonId = String(formData.get("lessonId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 2000);

  const studentId = await resolveStudent(
    user,
    role,
    String(formData.get("studentId") ?? ""),
  );
  if (!studentId) return { ok: false, error: "Not your student." };
  if (!lessonId || !(await studentOwnsLesson(studentId, lessonId))) {
    return { ok: false, error: "That lesson isn't yours to move." };
  }

  const original = await getReschedulableLesson(lessonId);
  if (!original) return { ok: false, error: "Lesson not found." };
  const now = new Date();
  if (new Date(`${original.date}T${original.startTime}`).getTime() <= now.getTime()) {
    return { ok: false, error: "That lesson has already started." };
  }

  const term = resolveTerm(original.date, await getTerms());
  if (!term) {
    return {
      ok: false,
      error: "That lesson is outside a known term - message the office.",
    };
  }
  if (!meetsRescheduleNotice(now, original.date, original.startTime)) {
    return {
      ok: false,
      error: "Reschedules need at least 7 days notice - message the office.",
    };
  }
  if (remaining(RESCHEDULE_CAP, await getReschedulesUsed(studentId, term.id)) <= 0) {
    return {
      ok: false,
      error: "You have used all 3 reschedules this term - message the office.",
    };
  }
  // This lesson must not already have been dealt with - cancelled, moved (a
  // pending or approved reschedule), or otherwise marked absent - or this
  // would double-grant a credit for the same slot.
  const [cancelled, moved, absent] = await Promise.all([
    isLessonCancelled(lessonId, studentId),
    hasPriorReschedule(studentId, lessonId),
    isLessonAbsent(lessonId, studentId),
  ]);
  if (cancelled || moved || absent) {
    return {
      ok: false,
      error: "That lesson has already been moved or cancelled - message the office.",
    };
  }

  await markStudentAbsent(lessonId, studentId, reason, user.id);
  await grantCredit({
    studentId,
    subjectId: original.subjectId,
    termId: term.id,
    reason: "reschedule_no_slot",
    fromLessonId: lessonId,
    grantedById: user.id,
    expiresAt: term.endDate,
  });

  const recipients = new Set<string>([original.tutorId]);
  const parents = await db
    .select({ id: familyLinks.parentId })
    .from(familyLinks)
    .where(eq(familyLinks.studentId, studentId));
  for (const p of parents) recipients.add(p.id);
  for (const a of await getAdminIds()) recipients.add(a);
  const body =
    `${await studentDisplayName(studentId)}'s ${original.subjectName} lesson on ` +
    `${formatDateLong(original.date)} was converted to a class credit ` +
    `(no reschedule slot was available).`;
  const notifRows = Array.from(recipients).map((userId) => ({
    userId,
    channel: "in_app" as const,
    title: "Class credit added",
    body,
  }));
  if (notifRows.length) await db.insert(notifications).values(notifRows);

  revalidatePath("/student/timetable");
  revalidatePath("/parent/classes");
  revalidatePath("/admin/attendance");
  return { ok: true, message: "Class credit added." };
}

// --- Approver actions (tutor of the class, or any admin) --------------------

async function canDecide(user: { id: string }, role: string, requestId: string) {
  if (role === "admin") return true;
  if (role !== "tutor") return false;
  const rows = await db
    .select({ tutorId: classes.tutorId })
    .from(rescheduleRequests)
    .innerJoin(lessons, eq(lessons.id, rescheduleRequests.originalLessonId))
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .where(eq(rescheduleRequests.id, requestId))
    .limit(1);
  return rows.length > 0 && rows[0].tutorId === user.id;
}

export async function approveReschedule(id: string): Promise<Result> {
  const user = await requireRole(["tutor", "admin"]);
  const role = coarseRole(user.app_metadata?.role as UserRole);
  if (!(await canDecide(user, role, id))) {
    return { ok: false, error: "Not yours to approve." };
  }
  const res = await approveRescheduleRequest(id, user.id);
  if (!res.ok) return res;
  revalidatePath("/tutor/reschedules");
  revalidatePath("/admin/reschedules");
  revalidatePath("/admin/attendance");
  return { ok: true, message: "Approved and moved." };
}

export async function rejectReschedule(id: string, reason?: string): Promise<Result> {
  const user = await requireRole(["tutor", "admin"]);
  const role = coarseRole(user.app_metadata?.role as UserRole);
  if (!(await canDecide(user, role, id))) {
    return { ok: false, error: "Not yours to decline." };
  }
  const res = await rejectRescheduleRequest(id, user.id, reason?.trim().slice(0, 2000));
  if (!res.ok) return res;
  revalidatePath("/tutor/reschedules");
  revalidatePath("/admin/reschedules");
  return { ok: true, message: "Request declined." };
}
