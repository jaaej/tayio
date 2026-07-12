"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, familyLinks, lessons, rescheduleRequests } from "@/db/schema";
import type { UserRole } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { coarseRole } from "@/lib/roles";
import {
  createRescheduleRequest,
  executeMakeupReschedule,
  getOneOnOneSlots,
  getReschedulableLesson,
  hasPriorReschedule,
  recordDirectMakeup,
  reschedulePath,
  studentOwnsLesson,
  approveRescheduleRequest,
  rejectRescheduleRequest,
} from "@/lib/reschedule";

type Result = { ok: true; message: string } | { ok: false; error: string };

export type RescheduleSlot = {
  tutorId: string;
  date: string;
  startTime: string;
  endTime: string;
  tutorName: string;
};

export type RescheduleOptions =
  | {
      ok: true;
      approvalRequired: boolean;
      /** True when the lesson has already been rescheduled — this move needs
       *  approval regardless of timing. */
      secondReschedule: boolean;
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

async function parentLinked(parentId: string, studentId: string): Promise<boolean> {
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

async function resolveStudent(
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

/**
 * Load the reschedule options for a lesson: the tutor's open availability slots
 * and whether the move needs approval. Used by the inline timetable picker.
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
  const secondReschedule = await hasPriorReschedule(studentId, lessonId);
  return {
    ok: true,
    approvalRequired:
      reschedulePath(original, now) === "approval" || secondReschedule,
    secondReschedule,
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
    })),
  };
}

/**
 * Student (unrestricted) or parent reschedules a lesson to a tutor-availability
 * slot. Routing: 1-on-1 (always) and group <24h create a pending approval
 * request; group ≥24h moves directly. Slot = "tutorId|date|start|end".
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
  const [tutorId, date, startTime, endTime] = parts;
  if (tutorId !== original.tutorId) {
    return { ok: false, error: "Slot must be with your tutor." };
  }
  const slots = await getOneOnOneSlots(original, now);
  if (
    !slots.some(
      (s) => s.tutorId === tutorId && s.date === date && s.startTime === startTime,
    )
  ) {
    return { ok: false, error: "That time is no longer available — pick another." };
  }

  const done = () => {
    revalidatePath("/student/timetable");
    revalidatePath("/parent/classes");
    revalidatePath("/admin/attendance");
  };

  // A second reschedule of the same lesson always needs approval.
  const priorReschedule = await hasPriorReschedule(studentId, lessonId);

  if (reschedulePath(original, now) === "group_direct" && !priorReschedule) {
    const res = await executeMakeupReschedule({
      studentId,
      originalLessonId: lessonId,
      tutorId,
      date,
      startTime,
      endTime,
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
      endTime,
      reason,
    });
    done();
    return { ok: true, message: "Lesson moved." };
  }

  await createRescheduleRequest({
    studentId,
    requestedById: user.id,
    originalLessonId: lessonId,
    reason,
    target: { kind: "makeup", tutorId, date, startTime, endTime },
  });
  done();
  return { ok: true, message: "Sent for approval." };
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
