"use server";

import { revalidatePath } from "next/cache";
import type { UserRole } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { coarseRole } from "@/lib/roles";
import {
  cancelLesson as cancelLessonInDb,
  getRedemptionSlots,
  redeemCreditIntoSlot,
} from "@/lib/credits";
import { studentOwnsLesson } from "@/lib/reschedule";
import { resolveStudent, type RescheduleSlot } from "@/app/_actions/reschedule";

type Result = { ok: true; message: string } | { ok: false; error: string };

/**
 * Student (unrestricted) or parent cancels a lesson outright (no reschedule),
 * gated on 24h notice and the per-term cancellation cap. Grants a class credit
 * in place of the lesson - see lib `cancelLesson` for the notice/cap checks.
 */
export async function cancelLesson(formData: FormData): Promise<Result> {
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
    return { ok: false, error: "That lesson isn't yours to cancel." };
  }

  const res = await cancelLessonInDb({
    studentId,
    lessonId,
    reason,
    actorId: user.id,
  });
  if (!res.ok) return res;

  revalidatePath("/student/timetable");
  revalidatePath("/parent/classes");
  revalidatePath("/admin/reschedules");
  return { ok: true, message: "Lesson cancelled - class credit added." };
}

/**
 * Student (unrestricted) or parent redeems a class credit into a tutor-
 * availability slot. Slot = "tutorId|date|start|end". Ownership of the
 * credit (credit.studentId === resolved student) is enforced by the lib.
 */
export async function redeemCredit(formData: FormData): Promise<Result> {
  const user = await requireRole(["student_unrestricted", "parent"]);
  const role = coarseRole(user.app_metadata?.role as UserRole);

  const creditId = String(formData.get("creditId") ?? "");
  const studentId = await resolveStudent(
    user,
    role,
    String(formData.get("studentId") ?? ""),
  );
  if (!studentId) return { ok: false, error: "Not your student." };
  if (!creditId) return { ok: false, error: "Pick a credit first." };

  const parts = String(formData.get("slot") ?? "").split("|");
  if (parts.length !== 4) return { ok: false, error: "Pick a time first." };
  const [tutorId, date, startTime] = parts;

  // Re-derive the credit's real availability server-side and reject anything
  // the client submitted that isn't in it - never trust the formData slot as-is.
  const available = await getRedemptionSlots(creditId, studentId);
  if (!available.ok) return available;
  if (!available.slots.some((s) => s.tutorId === tutorId)) {
    return { ok: false, error: "That time is no longer available - pick another." };
  }
  // Never trust the client's endTime - use the matched server slot's, so the
  // clash guard and the inserted lesson's duration are both server-derived.
  const matchedSlot = available.slots.find(
    (s) => s.date === date && s.startTime === startTime,
  );
  if (!matchedSlot) {
    return { ok: false, error: "That time is no longer available - pick another." };
  }

  const res = await redeemCreditIntoSlot({
    creditId,
    holderId: studentId,
    actorId: user.id,
    tutorId,
    date,
    startTime,
    endTime: matchedSlot.endTime,
  });
  if (!res.ok) return res;

  revalidatePath("/student/timetable");
  revalidatePath("/parent/classes");
  revalidatePath("/admin/reschedules");
  return { ok: true, message: "Class booked with your credit." };
}

/**
 * Load the redemption options for a credit: the origin tutor's open
 * availability slots. Used by the inline timetable picker.
 */
export async function loadCreditRedemption(
  creditId: string,
  studentIdArg?: string,
): Promise<
  | { ok: true; subjectName: string; slots: RescheduleSlot[] }
  | { ok: false; error: string }
> {
  const user = await requireRole(["student_unrestricted", "parent"]);
  const role = coarseRole(user.app_metadata?.role as UserRole);
  const studentId = await resolveStudent(user, role, studentIdArg ?? "");
  if (!studentId) return { ok: false, error: "Not your student." };

  const res = await getRedemptionSlots(creditId, studentId);
  if (!res.ok) return res;

  return {
    ok: true,
    subjectName: res.subjectName,
    slots: res.slots.map((s) => ({
      tutorId: s.tutorId,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      tutorName: s.tutorName,
      taken: s.taken,
    })),
  };
}
