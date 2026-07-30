import "server-only";
import { and, eq, gt, gte, inArray, isNull, lt, lte, notInArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  allowanceAdjustments,
  attendance,
  classCredits,
  classes,
  enrollments,
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
import {
  expandAvailability,
  markTakenSlots,
  type AvailableSlot,
} from "@/lib/availability";

/** An executor is either `db` directly or a `db.transaction(...)` callback's
 *  `tx` - both expose the same query-builder API, so writes can be pointed at
 *  whichever is in scope without duplicating call sites. */
type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

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

/** Admin-granted bonus allowance for a student+term, summed per kind. The
 *  effective per-term cap is the base cap (3) plus the matching bonus. Returns
 *  zeros when no top-up has been granted. */
export async function getAllowanceBonus(
  studentId: string,
  termId: string,
): Promise<{ reschedule: number; cancellation: number }> {
  const rows = await db
    .select({
      kind: allowanceAdjustments.kind,
      total: sql<number>`coalesce(sum(${allowanceAdjustments.bonus}), 0)::int`,
    })
    .from(allowanceAdjustments)
    .where(
      and(
        eq(allowanceAdjustments.studentId, studentId),
        eq(allowanceAdjustments.termId, termId),
      ),
    )
    .groupBy(allowanceAdjustments.kind);

  let reschedule = 0;
  let cancellation = 0;
  for (const r of rows) {
    if (r.kind === "reschedule") reschedule = Number(r.total);
    else cancellation = Number(r.total);
  }
  return { reschedule, cancellation };
}

export async function grantCredit(
  p: {
    studentId: string;
    subjectId: string;
    termId: string;
    reason: "cancellation" | "reschedule_no_slot" | "admin_grant";
    fromLessonId: string | null;
    grantedById: string;
    expiresAt: string;
  },
  executor: DbExecutor = db,
): Promise<string> {
  const [row] = await executor
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
  const bonus = await getAllowanceBonus(p.studentId, term.id);
  if (
    remaining(
      CANCEL_CAP + bonus.cancellation,
      await getCancellationsUsed(p.studentId, term.id),
    ) <= 0
  ) {
    return {
      ok: false,
      error: "You have used all your cancellations this term - message the office.",
    };
  }

  // All three writes must land together, or none should: an absence with no
  // credit (or a credit with no cancellation record) is a lost or duplicated
  // benefit. The notification goes out only after the transaction commits -
  // a failed notification must never roll back a real cancellation.
  const creditId = await db.transaction(async (tx) => {
    await markStudentAbsent(p.lessonId, p.studentId, p.reason, p.actorId, tx);
    const creditId = await grantCredit(
      {
        studentId: p.studentId,
        subjectId: lesson.subjectId,
        termId: term.id,
        reason: "cancellation",
        fromLessonId: p.lessonId,
        grantedById: p.actorId,
        expiresAt: term.endDate,
      },
      tx,
    );
    await tx.insert(lessonCancellations).values({
      lessonId: p.lessonId,
      studentId: p.studentId,
      cancelledById: p.actorId,
      termId: term.id,
      creditId,
      reason: p.reason,
    });
    return creditId;
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
  grantReason: "cancellation" | "reschedule_no_slot" | "admin_grant";
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

/** Has this student already had this specific lesson cancelled (a class
 *  credit already granted via `cancelLesson`)? Used by the UI to hide a stale
 *  Cancel action - `cancelLesson` re-derives this defensively either way. */
export async function isLessonCancelled(
  lessonId: string,
  studentId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: lessonCancellations.lessonId })
    .from(lessonCancellations)
    .where(
      and(
        eq(lessonCancellations.lessonId, lessonId),
        eq(lessonCancellations.studentId, studentId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Of these lesson ids, which has this student already had cancelled (a
 *  `lessonCancellations` row exists)? Batched form of `isLessonCancelled` for
 *  a timetable's worth of lessons - used to hide a stale Cancel/Reschedule
 *  action per lesson; the server re-derives this defensively either way. */
export async function getCancelledLessonIds(
  studentId: string,
  lessonIds: string[],
): Promise<Set<string>> {
  if (lessonIds.length === 0) return new Set();
  const rows = await db
    .select({ lessonId: lessonCancellations.lessonId })
    .from(lessonCancellations)
    .where(
      and(
        eq(lessonCancellations.studentId, studentId),
        inArray(lessonCancellations.lessonId, lessonIds),
      ),
    );
  return new Set(rows.map((r) => r.lessonId));
}

/** Has this student already had a class credit granted from this lesson (via
 *  `cancelLesson` or `grantRescheduleCredit`)? Any status counts - even a
 *  redeemed credit means the lesson was already converted to a credit, so it
 *  must not also be turned into a real makeup reschedule. */
export async function hasCreditFromLesson(
  studentId: string,
  lessonId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: classCredits.id })
    .from(classCredits)
    .where(
      and(
        eq(classCredits.grantedFromLessonId, lessonId),
        eq(classCredits.studentId, studentId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Of these lesson ids, which has this student already had a class credit
 *  granted from (any status)? Batched form of `hasCreditFromLesson` for a
 *  timetable's worth of lessons - used to hide a stale Cancel/Reschedule
 *  action per lesson; the server re-derives this defensively either way. */
export async function getCreditGrantedLessonIds(
  studentId: string,
  lessonIds: string[],
): Promise<Set<string>> {
  if (lessonIds.length === 0) return new Set();
  const rows = await db
    .select({ lessonId: classCredits.grantedFromLessonId })
    .from(classCredits)
    .where(
      and(
        eq(classCredits.studentId, studentId),
        inArray(classCredits.grantedFromLessonId, lessonIds),
      ),
    );
  return new Set(
    rows.map((r) => r.lessonId).filter((id): id is string => id !== null),
  );
}

async function loadActiveCredit(creditId: string, holderId: string) {
  const [credit] = await db
    .select({
      id: classCredits.id,
      studentId: classCredits.studentId,
      subjectId: classCredits.subjectId,
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
  // A credit granted from a cancelled/rescheduled lesson carries that origin
  // lesson (used to source the tutor). An admin-granted credit has no origin
  // lesson - its redeemable tutors come from the student's active enrolment in
  // the credit's subject instead (resolved by the callers below).
  return { ok: true as const, credit };
}

/** Tutors whose availability a credit can be redeemed against: the origin
 *  lesson's tutor for a cancellation/reschedule credit, or every tutor of the
 *  student's active same-subject classes for an admin-granted credit. */
async function creditRedemptionTutors(credit: {
  studentId: string;
  subjectId: string;
  grantedFromLessonId: string | null;
}): Promise<
  | { ok: true; tutors: { id: string; firstName: string; lastName: string }[] }
  | { ok: false; error: string }
> {
  if (credit.grantedFromLessonId) {
    const [origin] = await db
      .select({ tutorId: lessons.tutorId })
      .from(lessons)
      .where(eq(lessons.id, credit.grantedFromLessonId))
      .limit(1);
    if (!origin) return { ok: false, error: "Origin lesson not found" };
    const [t] = await db
      .select({ firstName: profiles.firstName, lastName: profiles.lastName })
      .from(profiles)
      .where(eq(profiles.id, origin.tutorId))
      .limit(1);
    return {
      ok: true,
      tutors: [
        {
          id: origin.tutorId,
          firstName: t?.firstName ?? "",
          lastName: t?.lastName ?? "",
        },
      ],
    };
  }

  const rows = await db
    .selectDistinct({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(profiles, eq(profiles.id, classes.tutorId))
    .where(
      and(
        eq(enrollments.studentId, credit.studentId),
        eq(classes.subjectId, credit.subjectId),
        isNull(enrollments.withdrawnAt),
      ),
    );
  if (rows.length === 0) {
    return {
      ok: false,
      error: "No tutor is available for this credit - message the office.",
    };
  }
  return { ok: true, tutors: rows };
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

  const resolved = await creditRedemptionTutors(credit);
  if (!resolved.ok) return resolved;

  const slots = await markTakenSlots(
    await expandAvailability(
      resolved.tutors.map((t) => ({
        id: t.id,
        firstName: t.firstName,
        lastName: t.lastName,
        isOriginal: true,
      })),
      new Date(),
      4,
    ),
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

/** Thrown inside the redemption transaction when the credit-status flip
 *  affects zero rows - another redeem already won the race - so the
 *  just-inserted makeup lesson + attendance roll back with it. */
class CreditAlreadyRedeemedError extends Error {}

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

  // Which class the new make-up lesson hangs off. For a cancellation/reschedule
  // credit it's the origin lesson's class; for an admin-granted credit it's the
  // student's active same-subject class taught by the picked tutor.
  let classId: string;
  if (credit.grantedFromLessonId) {
    const [origin] = await db
      .select({ classId: lessons.classId })
      .from(lessons)
      .where(eq(lessons.id, credit.grantedFromLessonId))
      .limit(1);
    if (!origin) return { ok: false, error: "Origin lesson not found" };
    classId = origin.classId;
  } else {
    const [cls] = await db
      .select({ id: classes.id })
      .from(enrollments)
      .innerJoin(classes, eq(classes.id, enrollments.classId))
      .where(
        and(
          eq(enrollments.studentId, credit.studentId),
          eq(classes.subjectId, credit.subjectId),
          eq(classes.tutorId, p.tutorId),
          isNull(enrollments.withdrawnAt),
        ),
      )
      .limit(1);
    if (!cls) {
      return { ok: false, error: "That tutor isn't available for this credit - pick another." };
    }
    classId = cls.id;
  }

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

  let newLesson: { id: string };
  try {
    newLesson = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(lessons)
        .values({
          classId,
          tutorId: p.tutorId,
          date: p.date,
          startTime: p.startTime,
          endTime: p.endTime,
          status: "makeup",
        })
        .returning({ id: lessons.id });

      await tx.insert(attendance).values({
        lessonId: inserted.id,
        studentId: credit.studentId,
        status: "makeup_attended",
        note: "Credit redeemed",
        markedBy: p.actorId,
      });

      // Conditional flip: only succeeds if the credit was still "active" the
      // moment this ran. If another redeem already flipped it, zero rows
      // come back and we throw to roll back the lesson + attendance just
      // inserted above - the two redeems must not both create a lesson.
      const flipped = await tx
        .update(classCredits)
        .set({
          status: "redeemed",
          redeemedOnLessonId: inserted.id,
          redeemedById: p.actorId,
          redeemedAt: new Date(),
        })
        .where(
          and(eq(classCredits.id, p.creditId), eq(classCredits.status, "active")),
        )
        .returning({ id: classCredits.id });
      if (flipped.length === 0) {
        throw new CreditAlreadyRedeemedError();
      }

      return inserted;
    });
  } catch (err) {
    if (err instanceof CreditAlreadyRedeemedError) {
      return {
        ok: false,
        error: "That credit was already used - refresh and try again.",
      };
    }
    throw err;
  }

  await notifyRedemption({
    studentId: credit.studentId,
    tutorId: p.tutorId,
    subjectName: credit.subjectName,
    date: p.date,
  });

  return { ok: true, lessonId: newLesson.id };
}
