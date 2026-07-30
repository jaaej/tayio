import "server-only";
import { and, eq, gt, gte, inArray, lt, lte, notInArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  attendance,
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
import { formatDateLong, isoDate } from "@/lib/format";
import {
  CANCEL_CAP,
  deriveCreditStatus,
  meetsCancelNotice,
  remaining,
  resolveTerm,
  type TermRow,
} from "@/lib/reschedule-credits";
import { getAdminIds, markStudentAbsent, studentDisplayName } from "@/lib/reschedule";
import { expandAvailability, type AvailableSlot } from "@/lib/availability";

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

  // Defensive guard against a double credit: the client hides Cancel for a
  // lesson that's already been moved, but a raw lessonId can still reach this
  // action directly. Reject if this lesson already has a live/approved
  // reschedule, or the student is already marked absent on it (e.g. from a
  // prior cancellation or reschedule) - re-derive from the DB, never trust
  // the caller's state.
  const [existingReschedule] = await db
    .select({ id: rescheduleRequests.id })
    .from(rescheduleRequests)
    .where(
      and(
        eq(rescheduleRequests.originalLessonId, p.lessonId),
        eq(rescheduleRequests.studentId, p.studentId),
        inArray(rescheduleRequests.status, ["approved", "pending"]),
      ),
    )
    .limit(1);
  if (existingReschedule) {
    return {
      ok: false,
      error: "That lesson has already been moved or cancelled - message the office.",
    };
  }
  const [existingAbsence] = await db
    .select({ lessonId: attendance.lessonId })
    .from(attendance)
    .where(
      and(
        eq(attendance.lessonId, p.lessonId),
        eq(attendance.studentId, p.studentId),
        eq(attendance.status, "absent"),
      ),
    )
    .limit(1);
  if (existingAbsence) {
    return {
      ok: false,
      error: "That lesson has already been moved or cancelled - message the office.",
    };
  }

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

// --- Redemption ---------------------------------------------------------

export type RedeemableCredit = {
  id: string;
  subjectName: string;
  expiresAt: string;
  grantReason: "cancellation" | "reschedule_no_slot";
};

/** The student's currently-redeemable credits (effective status "active").
 *  Opportunistically flips any stored-active row past its expiresAt to
 *  "expired" - best-effort, correctness doesn't depend on it. */
export async function listRedeemableCredits(
  studentId: string,
): Promise<RedeemableCredit[]> {
  const rows = await db
    .select({
      id: classCredits.id,
      subjectName: subjects.name,
      status: classCredits.status,
      expiresAt: classCredits.expiresAt,
      grantReason: classCredits.grantReason,
    })
    .from(classCredits)
    .innerJoin(subjects, eq(subjects.id, classCredits.subjectId))
    .where(
      and(eq(classCredits.studentId, studentId), eq(classCredits.status, "active")),
    );

  const today = isoDate(new Date());
  const out: RedeemableCredit[] = [];
  const expiredIds: string[] = [];
  for (const r of rows) {
    const effective = deriveCreditStatus(r.status, r.expiresAt, today);
    if (effective === "active") {
      out.push({
        id: r.id,
        subjectName: r.subjectName,
        expiresAt: r.expiresAt,
        grantReason: r.grantReason,
      });
    } else if (effective === "expired") {
      expiredIds.push(r.id);
    }
  }

  if (expiredIds.length) {
    try {
      await db
        .update(classCredits)
        .set({ status: "expired" })
        .where(inArray(classCredits.id, expiredIds));
    } catch {
      // best-effort; a stale "active" row is re-checked (and re-attempted) next read
    }
  }

  return out;
}

async function loadActiveCredit(creditId: string, holderId: string) {
  const [credit] = await db
    .select({
      id: classCredits.id,
      studentId: classCredits.studentId,
      status: classCredits.status,
      expiresAt: classCredits.expiresAt,
      subjectName: subjects.name,
      grantedFromLessonId: classCredits.grantedFromLessonId,
    })
    .from(classCredits)
    .innerJoin(subjects, eq(subjects.id, classCredits.subjectId))
    .where(eq(classCredits.id, creditId))
    .limit(1);
  if (!credit) return { ok: false as const, error: "Credit not found" };
  if (credit.studentId !== holderId) {
    return { ok: false as const, error: "Not your credit" };
  }
  if (
    deriveCreditStatus(credit.status, credit.expiresAt, isoDate(new Date())) !==
    "active"
  ) {
    return { ok: false as const, error: "That credit is no longer available" };
  }
  if (!credit.grantedFromLessonId) {
    return { ok: false as const, error: "That credit has no origin lesson" };
  }
  return { ok: true as const, credit };
}

export async function getRedemptionSlots(
  creditId: string,
  holderId: string,
): Promise<
  | { ok: true; slots: AvailableSlot[]; subjectName: string }
  | { ok: false; error: string }
> {
  const loaded = await loadActiveCredit(creditId, holderId);
  if (!loaded.ok) return loaded;
  const { credit } = loaded;

  const [origin] = await db
    .select({ tutorId: lessons.tutorId })
    .from(lessons)
    .where(eq(lessons.id, credit.grantedFromLessonId!))
    .limit(1);
  if (!origin) return { ok: false, error: "Origin lesson not found" };

  const [t] = await db
    .select({ firstName: profiles.firstName, lastName: profiles.lastName })
    .from(profiles)
    .where(eq(profiles.id, origin.tutorId))
    .limit(1);

  const slots = await expandAvailability(
    [
      {
        id: origin.tutorId,
        firstName: t?.firstName ?? "",
        lastName: t?.lastName ?? "",
        isOriginal: true,
      },
    ],
    new Date(),
    4,
  );
  return { ok: true, slots, subjectName: credit.subjectName };
}

async function notifyRedemption(o: {
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
  const body = `${name}'s ${o.subjectName} credit was redeemed for a lesson on ${formatDateLong(o.date)}.`;
  const rows = Array.from(recipients).map((userId) => ({
    userId,
    channel: "in_app" as const,
    title: "Credit redeemed",
    body,
  }));
  if (rows.length) await db.insert(notifications).values(rows);
}

export async function redeemCreditIntoSlot(p: {
  creditId: string;
  holderId: string;
  actorId: string;
  tutorId: string;
  date: string;
  startTime: string;
  endTime: string;
}): Promise<{ ok: true; lessonId: string } | { ok: false; error: string }> {
  const loaded = await loadActiveCredit(p.creditId, p.holderId);
  if (!loaded.ok) return loaded;
  const { credit } = loaded;

  const [origin] = await db
    .select({ classId: lessons.classId })
    .from(lessons)
    .where(eq(lessons.id, credit.grantedFromLessonId!))
    .limit(1);
  if (!origin) return { ok: false, error: "Origin lesson not found" };

  // Double-booking guard: any lesson for this tutor overlapping the slot?
  const clash = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(
      and(
        eq(lessons.tutorId, p.tutorId),
        eq(lessons.date, p.date),
        lt(lessons.startTime, p.endTime),
        gt(lessons.endTime, p.startTime),
      ),
    )
    .limit(1);
  if (clash.length) {
    return { ok: false, error: "That slot was just taken - pick another." };
  }

  const [newLesson] = await db
    .insert(lessons)
    .values({
      classId: origin.classId,
      tutorId: p.tutorId,
      date: p.date,
      startTime: p.startTime,
      endTime: p.endTime,
      status: "makeup",
    })
    .returning({ id: lessons.id });

  await db.insert(attendance).values({
    lessonId: newLesson.id,
    studentId: credit.studentId,
    status: "makeup_attended",
    note: "Credit redeemed",
    markedBy: p.actorId,
  });

  await db
    .update(classCredits)
    .set({
      status: "redeemed",
      redeemedOnLessonId: newLesson.id,
      redeemedById: p.actorId,
      redeemedAt: new Date(),
    })
    .where(eq(classCredits.id, p.creditId));

  await notifyRedemption({
    studentId: credit.studentId,
    tutorId: p.tutorId,
    subjectName: credit.subjectName,
    date: p.date,
  });

  return { ok: true, lessonId: newLesson.id };
}
