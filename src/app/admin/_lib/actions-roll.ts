"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  attendance,
  classCredits,
  classes,
  enrollments,
  lessonCancellations,
  lessonNotes,
  lessonRollExclusions,
  lessons,
  profiles,
  rescheduleRequests,
} from "@/db/schema";
import { onRosterSql, melbourneStartOfDaySql } from "@/lib/class-roster-sql";
import { lessonRollIds } from "@/lib/lesson-roll";
import { oneOnOneError } from "@/lib/class-capacity";
import { coarseRole } from "@/lib/roles";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { withActor } from "@/lib/with-actor";
import { requireAdmin } from "./guard";

const inputSchema = z.object({
  lessonId: z.string().uuid(),
  studentId: z.string().uuid(),
  /** "lesson": this lesson only; "onwards": this lesson and every one after. */
  scope: z.enum(["lesson", "onwards"]),
});

export type RollChangeResult = { ok: true } | { ok: false; error: string };

type Lesson = {
  id: string;
  classId: string;
  date: string;
  status: (typeof lessons.$inferSelect)["status"];
  classType: string;
};

async function loadLesson(lessonId: string): Promise<Lesson | null> {
  const [row] = await db
    .select({
      id: lessons.id,
      classId: lessons.classId,
      date: lessons.date,
      status: lessons.status,
      classType: classes.classType,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .where(eq(lessons.id, lessonId))
    .limit(1);
  return row ?? null;
}

/** Why this lesson's roll can't be edited here, or null. */
function lessonError(lesson: Lesson | null): string | null {
  if (!lesson) return "This lesson no longer exists.";
  // A make-up is a private booking; its roll is its bookings.
  if (lesson.status === "makeup") return "A make-up lesson's students come from its bookings.";
  if (lesson.status === "cancelled" || lesson.status === "rescheduled") return "This lesson isn't running.";
  return null;
}

/** Is the student in the class on this lesson (`onRosterSql`)? */
async function onClassRoster(lesson: Lesson, studentId: string): Promise<boolean> {
  const [row] = await db
    .select({ studentId: enrollments.studentId })
    .from(enrollments)
    .innerJoin(lessons, eq(lessons.classId, enrollments.classId))
    .where(and(eq(lessons.id, lesson.id), eq(enrollments.studentId, studentId), onRosterSql("enrollments", "lessons")))
    .limit(1);
  return Boolean(row);
}

function revalidateRoll(lessonId: string) {
  revalidatePath(`/admin/attendance/${lessonId}`);
  revalidatePath("/admin/attendance");
  revalidatePath("/admin", "layout");
  revalidatePath(`/tutor/lessons/${lessonId}`);
  revalidatePath("/tutor", "layout");
  revalidatePath("/student", "layout");
  revalidatePath("/parent", "layout");
}

/**
 * Put a student on a lesson's roll: for this lesson only (a one-off visit,
 * recorded like a make-up: attendance "Make-up"), or from this lesson on (they
 * join the class from its date). A class student taken off this lesson alone
 * is simply put back.
 */
export async function addStudentToLesson(input: z.input<typeof inputSchema>): Promise<RollChangeResult> {
  const user = await requireAdmin();
  const { lessonId, studentId, scope } = inputSchema.parse(input);
  const lesson = await loadLesson(lessonId);
  const blocked = lessonError(lesson);
  if (blocked || !lesson) return { ok: false, error: blocked ?? "This lesson no longer exists." };

  const [student] = await db
    .select({ role: profiles.role, isActive: profiles.isActive })
    .from(profiles)
    .where(eq(profiles.id, studentId))
    .limit(1);
  if (!student || coarseRole(student.role) !== "student" || !student.isActive) {
    return { ok: false, error: "Only an active student can be added." };
  }
  if ((await lessonRollIds(lesson)).has(studentId)) {
    return { ok: false, error: "They're already on this lesson." };
  }

  if (scope === "onwards" && lesson.classType === "one_on_one") {
    const [{ current }] = await db
      .select({ current: sql<number>`count(*)::int` })
      .from(enrollments)
      .where(and(eq(enrollments.classId, lesson.classId), isNull(enrollments.withdrawnAt)));
    if (oneOnOneError("one_on_one", current + 1)) return { ok: false, error: "A one-on-one class has one student. Add them to this lesson only, or withdraw the other student first." };
  }

  await withActor({ id: user.id, role: "admin" }, async (tx) => {
    // Taken off this lesson alone before: putting them back is enough for "lesson".
    const excluded = await tx
      .delete(lessonRollExclusions)
      .where(and(eq(lessonRollExclusions.lessonId, lessonId), eq(lessonRollExclusions.studentId, studentId)))
      .returning({ studentId: lessonRollExclusions.studentId });

    if (scope === "lesson") {
      if (excluded.length > 0) return;
      await tx
        .insert(attendance)
        .values({ lessonId, studentId, status: "makeup_attended", markedBy: user.id })
        .onConflictDoNothing();
      return;
    }

    // From this lesson on: one stint per enrolment row, starting on its date.
    const [existing] = await tx
      .select({ withdrawnAt: enrollments.withdrawnAt })
      .from(enrollments)
      .where(and(eq(enrollments.classId, lesson.classId), eq(enrollments.studentId, studentId)));
    if (existing) {
      await tx
        .update(enrollments)
        .set({ enrolledAt: melbourneStartOfDaySql(lesson.date), withdrawnAt: null, endsOn: null })
        .where(and(eq(enrollments.classId, lesson.classId), eq(enrollments.studentId, studentId)));
    } else {
      await tx.insert(enrollments).values({
        classId: lesson.classId,
        studentId,
        enrolledAt: melbourneStartOfDaySql(lesson.date),
      });
    }
  });

  revalidateRoll(lessonId);
  return { ok: true };
}

/**
 * Take a student off a lesson's roll: this lesson only (a class student stays
 * in the class and the lesson does not count as an absence), or this lesson
 * and every one after (they leave the class from its date; earlier lessons
 * keep them). Their mark on this lesson is cleared. A student who moved,
 * cancelled or used a credit here, or has a tutor's note on it, is refused:
 * that record has its own place to undo it.
 */
export async function removeStudentFromLesson(input: z.input<typeof inputSchema>): Promise<RollChangeResult> {
  const user = await requireAdmin();
  const { lessonId, studentId, scope } = inputSchema.parse(input);
  const lesson = await loadLesson(lessonId);
  const blocked = lessonError(lesson);
  if (blocked || !lesson) return { ok: false, error: blocked ?? "This lesson no longer exists." };
  if (!(await lessonRollIds(lesson)).has(studentId)) {
    return { ok: false, error: "They're not on this lesson." };
  }

  const [[moved], [credit], [cancelled], [note]] = await Promise.all([
    db
      .select({ id: rescheduleRequests.id })
      .from(rescheduleRequests)
      .where(
        and(
          eq(rescheduleRequests.studentId, studentId),
          eq(rescheduleRequests.status, "approved"),
          or(eq(rescheduleRequests.originalLessonId, lessonId), eq(rescheduleRequests.targetLessonId, lessonId)),
        ),
      )
      .limit(1),
    db
      .select({ id: classCredits.id })
      .from(classCredits)
      .where(
        and(
          eq(classCredits.studentId, studentId),
          or(eq(classCredits.grantedFromLessonId, lessonId), eq(classCredits.redeemedOnLessonId, lessonId)),
        ),
      )
      .limit(1),
    db
      .select({ id: lessonCancellations.id })
      .from(lessonCancellations)
      .where(and(eq(lessonCancellations.studentId, studentId), eq(lessonCancellations.lessonId, lessonId)))
      .limit(1),
    db
      .select({ id: lessonNotes.id })
      .from(lessonNotes)
      .where(and(eq(lessonNotes.studentId, studentId), eq(lessonNotes.lessonId, lessonId)))
      .limit(1),
  ]);
  if (moved || credit || cancelled) {
    return { ok: false, error: "They moved, cancelled or used a credit for this lesson. Undo that from Reschedules first." };
  }
  if (note) {
    return { ok: false, error: "Their tutor has written a note for this lesson, so they stay on it." };
  }

  const inClass = await onClassRoster(lesson, studentId);
  const today = melbourneDate(new Date());
  await withActor({ id: user.id, role: "admin" }, async (tx) => {
    await tx.delete(attendance).where(and(eq(attendance.lessonId, lessonId), eq(attendance.studentId, studentId)));
    if (!inClass) return; // a one-off visitor: clearing the booking is all

    if (scope === "lesson") {
      await tx
        .insert(lessonRollExclusions)
        .values({ lessonId, studentId, excludedBy: user.id })
        .onConflictDoNothing();
      return;
    }

    // Leave the class from this lesson's date: today or earlier, at once;
    // a later date, on that day (`runEnrolmentEndSweep`).
    await tx
      .update(enrollments)
      .set({
        endsOn: lesson.date,
        ...(lesson.date <= today ? { withdrawnAt: sql`coalesce(${enrollments.withdrawnAt}, now())` } : {}),
      })
      .where(and(eq(enrollments.classId, lesson.classId), eq(enrollments.studentId, studentId)));
    // Exclusions on later lessons no longer mean anything.
    await tx
      .delete(lessonRollExclusions)
      .where(
        and(
          eq(lessonRollExclusions.studentId, studentId),
          sql`${lessonRollExclusions.lessonId} in (select id from lessons where class_id = ${lesson.classId} and date >= ${lesson.date})`,
        ),
      );
  });

  revalidateRoll(lessonId);
  return { ok: true };
}

