import "server-only";
import { and, eq, gte, lte, notInArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classCredits,
  classes,
  familyLinks,
  lessonCancellations,
  lessons,
  notifications,
  profiles,
  rescheduleRequests,
  subjects,
  terms,
} from "@/db/schema";
import { ADMIN_TIERS } from "@/lib/roles";
import { formatDateLong } from "@/lib/format";
import {
  CANCEL_CAP,
  meetsCancelNotice,
  remaining,
  resolveTerm,
  type TermRow,
} from "@/lib/reschedule-credits";
import { getAdminIds, markStudentAbsent, studentDisplayName } from "@/lib/reschedule";

export async function getTerms(): Promise<TermRow[]> {
  return db
    .select({ id: terms.id, startDate: terms.startDate, endDate: terms.endDate })
    .from(terms);
}

export async function getCancellationsUsed(
  studentId: string,
  termId: string,
): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(lessonCancellations)
    .where(
      and(
        eq(lessonCancellations.studentId, studentId),
        eq(lessonCancellations.termId, termId),
      ),
    );
  return Number(count);
}

export async function getReschedulesUsed(
  studentId: string,
  termId: string,
): Promise<number> {
  const [term] = await db
    .select({ startDate: terms.startDate, endDate: terms.endDate })
    .from(terms)
    .where(eq(terms.id, termId))
    .limit(1);
  if (!term) return 0;

  const [{ count: rescheduleCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rescheduleRequests)
    .innerJoin(lessons, eq(lessons.id, rescheduleRequests.originalLessonId))
    .innerJoin(profiles, eq(profiles.id, rescheduleRequests.requestedById))
    .where(
      and(
        eq(rescheduleRequests.studentId, studentId),
        eq(rescheduleRequests.status, "approved"),
        gte(lessons.date, term.startDate),
        lte(lessons.date, term.endDate),
        notInArray(profiles.role, [...ADMIN_TIERS]),
      ),
    );

  const [{ count: creditCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(classCredits)
    .where(
      and(
        eq(classCredits.studentId, studentId),
        eq(classCredits.termId, termId),
        eq(classCredits.grantReason, "reschedule_no_slot"),
      ),
    );

  return Number(rescheduleCount) + Number(creditCount);
}

export async function grantCredit(p: {
  studentId: string;
  subjectId: string;
  termId: string;
  reason: "cancellation" | "reschedule_no_slot";
  fromLessonId: string;
  grantedById: string;
  expiresAt: string;
}): Promise<string> {
  const [row] = await db
    .insert(classCredits)
    .values({
      studentId: p.studentId,
      subjectId: p.subjectId,
      termId: p.termId,
      grantReason: p.reason,
      grantedFromLessonId: p.fromLessonId,
      grantedById: p.grantedById,
      expiresAt: p.expiresAt,
    })
    .returning({ id: classCredits.id });
  return row.id;
}

async function notifyCancellation(o: {
  studentId: string;
  tutorId: string;
  subjectName: string;
  date: string;
}) {
  const recipients = new Set<string>([o.tutorId]);
  const parents = await db
    .select({ id: familyLinks.parentId })
    .from(familyLinks)
    .where(eq(familyLinks.studentId, o.studentId));
  for (const p of parents) recipients.add(p.id);
  for (const a of await getAdminIds()) recipients.add(a);

  const name = await studentDisplayName(o.studentId);
  const body = `${name}'s ${o.subjectName} lesson on ${formatDateLong(o.date)} was cancelled.`;
  const rows = Array.from(recipients).map((userId) => ({
    userId,
    channel: "in_app" as const,
    title: "Lesson cancelled",
    body,
  }));
  if (rows.length) await db.insert(notifications).values(rows);
}

export async function cancelLesson(p: {
  studentId: string;
  lessonId: string;
  reason: string;
  actorId: string;
}): Promise<{ ok: true; creditId: string } | { ok: false; error: string }> {
  const [lesson] = await db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      tutorId: lessons.tutorId,
      subjectId: classes.subjectId,
      subjectName: subjects.name,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(eq(lessons.id, p.lessonId))
    .limit(1);
  if (!lesson) return { ok: false, error: "Lesson not found" };

  const term = resolveTerm(lesson.date, await getTerms());
  if (!term) {
    return {
      ok: false,
      error: "That lesson is outside a known term - message the office.",
    };
  }

  if (!meetsCancelNotice(new Date(), lesson.date, lesson.startTime)) {
    return {
      ok: false,
      error: "Cancellations need at least 24 hours notice - message the office.",
    };
  }
  if (
    remaining(CANCEL_CAP, await getCancellationsUsed(p.studentId, term.id)) <= 0
  ) {
    return {
      ok: false,
      error: "You have used all 3 cancellations this term - message the office.",
    };
  }

  await markStudentAbsent(p.lessonId, p.studentId, p.reason, p.actorId);
  const creditId = await grantCredit({
    studentId: p.studentId,
    subjectId: lesson.subjectId,
    termId: term.id,
    reason: "cancellation",
    fromLessonId: p.lessonId,
    grantedById: p.actorId,
    expiresAt: term.endDate,
  });
  await db.insert(lessonCancellations).values({
    lessonId: p.lessonId,
    studentId: p.studentId,
    cancelledById: p.actorId,
    termId: term.id,
    creditId,
    reason: p.reason,
  });

  await notifyCancellation({
    studentId: p.studentId,
    tutorId: lesson.tutorId,
    subjectName: lesson.subjectName,
    date: lesson.date,
  });

  return { ok: true, creditId };
}
