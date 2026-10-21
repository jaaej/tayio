import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  attendance,
  classCredits,
  classes,
  familyLinks,
  lessonCancellations,
  lessonNotes,
  lessons,
  notifications,
  profiles,
  rescheduleRequests,
  subjects,
  terms,
  tutorCoverRequests,
} from "@/db/schema";
import { classDisplayName } from "@/lib/class-display";
import { formatDateLong, formatTime } from "@/lib/format";
import { lessonRollIds } from "@/lib/lesson-roll";
import { cancelCreditExpiry, cancelRefusal, creditTermFor } from "@/lib/lesson-cancel-rules";
import { forParent } from "@/lib/parent-child";
import { withActor } from "@/lib/with-actor";

/*
 * Taiyo cancels a lesson for everyone, most often because no tutor could
 * cover it (Cover & leave, or the lesson's page). The lesson is marked
 * cancelled, which takes it off the check-ins, the attendance queue and every
 * timetable's live lessons; each student it was for gets a class credit to
 * book a make-up (or has back the credit they spent on it); and the
 * students, their parents and the tutors are told.
 */

type LessonRow = {
  id: string;
  classId: string;
  date: string;
  startTime: string;
  status: (typeof lessons.$inferSelect)["status"];
  tutorId: string;
  subjectId: string;
  label: string;
};

async function loadLesson(lessonId: string): Promise<LessonRow | null> {
  const [row] = await db
    .select({
      id: lessons.id,
      classId: lessons.classId,
      date: lessons.date,
      startTime: lessons.startTime,
      status: lessons.status,
      tutorId: lessons.tutorId,
      subjectId: subjects.id,
      subjectName: subjects.name,
      className: classes.name,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!row) return null;
  return { ...row, label: classDisplayName(row.subjectName, row.className) };
}

export type CancelImpact = {
  /** Students the lesson was for: each gets a class credit. */
  students: { id: string; name: string }[];
  /** Why it can't be cancelled, or null. */
  refusal: string | null;
  label: string;
};

/**
 * Who a cancellation affects: everyone on the roll except students who had
 * already moved, cancelled or taken a credit for it (they have their own
 * arrangement), and whether it can be cancelled at all.
 */
export async function getCancelImpact(lessonId: string): Promise<CancelImpact | null> {
  const lesson = await loadLesson(lessonId);
  if (!lesson) return null;
  const [rollIds, marks, [notes], movedOut, creditedOut, familyCancelled] = await Promise.all([
    lessonRollIds(lesson),
    db.select({ status: attendance.status }).from(attendance).where(eq(attendance.lessonId, lessonId)),
    db.select({ n: sql<number>`count(*)::int` }).from(lessonNotes).where(eq(lessonNotes.lessonId, lessonId)),
    db
      .select({ studentId: rescheduleRequests.studentId })
      .from(rescheduleRequests)
      .where(and(eq(rescheduleRequests.originalLessonId, lessonId), eq(rescheduleRequests.status, "approved"))),
    db
      .select({ studentId: classCredits.studentId })
      .from(classCredits)
      .where(and(eq(classCredits.grantedFromLessonId, lessonId), ne(classCredits.grantReason, "lesson_cancelled"))),
    db.select({ studentId: lessonCancellations.studentId }).from(lessonCancellations).where(eq(lessonCancellations.lessonId, lessonId)),
  ]);
  const away = new Set([...movedOut, ...creditedOut, ...familyCancelled].map((r) => r.studentId));
  const ids = [...rollIds].filter((id) => !away.has(id));
  const people = ids.length
    ? await db
        .select({ id: profiles.id, firstName: profiles.firstName, lastName: profiles.lastName })
        .from(profiles)
        .where(inArray(profiles.id, ids))
        .orderBy(profiles.firstName, profiles.lastName)
    : [];
  return {
    label: lesson.label,
    students: people.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`.trim() })),
    refusal: cancelRefusal({ status: lesson.status, marks: marks.map((m) => m.status), notes: notes?.n ?? 0 }),
  };
}

export type CancelResult = { ok: true; students: number } | { ok: false; error: string };

/** Cancel the lesson for everyone (see the file comment). */
export async function cancelLessonForEveryone(lessonId: string, adminId: string): Promise<CancelResult> {
  const lesson = await loadLesson(lessonId);
  if (!lesson) return { ok: false, error: "This lesson no longer exists." };
  const impact = await getCancelImpact(lessonId);
  if (!impact) return { ok: false, error: "This lesson no longer exists." };
  if (impact.refusal) return { ok: false, error: impact.refusal };

  const termRows = await db.select({ id: terms.id, startDate: terms.startDate, endDate: terms.endDate }).from(terms);
  const term = creditTermFor(termRows, lesson.date);
  if (!term && impact.students.length > 0) {
    return { ok: false, error: "This lesson is after the last term, so its credits have no term. Add the next term first." };
  }
  const expiresAt = term ? cancelCreditExpiry(term.endDate, lesson.date) : lesson.date;
  const studentIds = impact.students.map((s) => s.id);
  const now = new Date();

  const coverTutorIds = await withActor({ id: adminId, role: "admin" }, async (tx) => {
    // Credits spent on this lesson come back; everyone else gets a new one.
    const spent = studentIds.length
      ? await tx
          .update(classCredits)
          .set({
            status: "active",
            redeemedOnLessonId: null,
            redeemedById: null,
            redeemedAt: null,
            expiresAt: sql`greatest(${classCredits.expiresAt}, ${expiresAt}::date)`,
          })
          .where(
            and(
              eq(classCredits.redeemedOnLessonId, lessonId),
              inArray(classCredits.studentId, studentIds),
            ),
          )
          .returning({ studentId: classCredits.studentId })
      : [];
    const restored = new Set(spent.map((r) => r.studentId));
    const fresh = studentIds.filter((id) => !restored.has(id));
    if (fresh.length > 0 && term) {
      await tx.insert(classCredits).values(
        fresh.map((studentId) => ({
          studentId,
          subjectId: lesson.subjectId,
          termId: term.id,
          grantReason: "lesson_cancelled" as const,
          grantedFromLessonId: lessonId,
          grantedById: adminId,
          expiresAt,
        })),
      );
    }
    // Their bookings and marks on it would count it as a lesson they had.
    if (studentIds.length > 0) {
      await tx
        .delete(attendance)
        .where(and(eq(attendance.lessonId, lessonId), inArray(attendance.studentId, studentIds)));
    }
    const covers = await tx
      .update(tutorCoverRequests)
      .set({ status: "cancelled", updatedAt: now })
      .where(and(eq(tutorCoverRequests.lessonId, lessonId), ne(tutorCoverRequests.status, "cancelled")))
      .returning({ originalTutorId: tutorCoverRequests.originalTutorId });
    await tx
      .update(lessons)
      .set({ status: "cancelled", cancelledAt: now, cancelledById: adminId })
      .where(eq(lessons.id, lessonId));
    return covers.map((c) => c.originalTutorId);
  });

  // Told after the change has committed: a failed notice never undoes it.
  try {
    await notifyCancelled(lesson, studentIds, coverTutorIds);
  } catch (error) {
    console.error("[lesson-cancel] notifications failed", lessonId, error);
  }
  return { ok: true, students: studentIds.length };
}

async function notifyCancelled(lesson: LessonRow, studentIds: string[], coverTutorIds: string[]) {
  const when = `${formatDateLong(lesson.date)}, ${formatTime(lesson.startTime)}`;
  const what = `${lesson.label} on ${when} is cancelled`;
  const [students, parents] = studentIds.length
    ? await Promise.all([
        db.select({ id: profiles.id, firstName: profiles.firstName }).from(profiles).where(inArray(profiles.id, studentIds)),
        db
          .select({ parentId: familyLinks.parentId, studentId: familyLinks.studentId })
          .from(familyLinks)
          .where(inArray(familyLinks.studentId, studentIds)),
      ])
    : [[], []];
  const firstName = new Map(students.map((s) => [s.id, s.firstName]));
  const childrenOf = new Map<string, string[]>();
  for (const p of parents) {
    childrenOf.set(p.parentId, [...(childrenOf.get(p.parentId) ?? []), firstName.get(p.studentId) ?? ""]);
  }
  const rows: (typeof notifications.$inferInsert)[] = [
    ...studentIds.map((userId) => ({
      userId,
      channel: "in_app" as const,
      title: "Lesson cancelled",
      body: `${what}. A class credit was added so you can book a make-up.`,
      href: "/student/timetable",
    })),
    ...[...childrenOf].map(([userId, names]) => ({
      userId,
      channel: "in_app" as const,
      title: "Lesson cancelled",
      body: forParent(names, `${what}, with a class credit to book a make-up.`),
      href: "/parent/timetable",
    })),
    ...[...new Set([lesson.tutorId, ...coverTutorIds])].map((userId) => ({
      userId,
      channel: "in_app" as const,
      title: "Lesson cancelled",
      body: `${what}.`,
      href: "/tutor/timetable",
    })),
  ];
  if (rows.length > 0) await db.insert(notifications).values(rows);
}

