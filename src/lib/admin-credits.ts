import "server-only";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  allowanceAdjustments,
  attendance,
  auditLogs,
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
import { formatDateLong, formatTime, isoDate } from "@/lib/format";
import {
  CANCEL_CAP,
  RESCHEDULE_CAP,
  deriveCreditStatus,
  resolveTerm,
  type CreditStatus,
} from "@/lib/reschedule-credits";
import {
  getAllowanceBonus,
  getCancellationsUsed,
  getReschedulesUsed,
  getTerms,
  grantCredit,
} from "@/lib/credits";

/** Thrown inside `undoCancellation`'s transaction when the credit was redeemed
 *  concurrently, to roll the whole undo back. */
class CreditRedeemedDuringUndoError extends Error {}

/** Thrown inside `undoRedemption`'s transaction when the credit is no longer
 *  redeemed onto the expected make-up (a concurrent undo/redeem), to roll back. */
class RedemptionChangedDuringUndoError extends Error {}

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Write one audit row for an admin credit/reschedule action. The trigger-based
 * audit (migration 0006) only covers profiles/enrollments/invoices/etc - these
 * lessons/credits/cancellations tables are not trigger-audited, so admin undos
 * and grants are logged explicitly here. Pass `tx` inside a transaction so the
 * audit row rolls back with the action if the action does; pass `db` for the
 * non-transactional grants.
 */
async function logAdminAudit(
  exec: typeof db | DbTx,
  entry: {
    actorId: string;
    action: string;
    tableName: string;
    oldData?: Record<string, unknown>;
    newData?: Record<string, unknown>;
  },
): Promise<void> {
  await exec.insert(auditLogs).values({
    actorId: entry.actorId,
    actorRole: "admin",
    action: entry.action,
    tableName: entry.tableName,
    oldData: entry.oldData ?? null,
    newData: entry.newData ?? null,
  });
}

// --- Notifications ----------------------------------------------------------

/** In-app notification to the student plus every linked parent. */
async function notifyStudentAndParents(
  studentId: string,
  title: string,
  body: string,
) {
  const recipients = new Set<string>([studentId]);
  const parents = await db
    .select({ id: familyLinks.parentId })
    .from(familyLinks)
    .where(eq(familyLinks.studentId, studentId));
  for (const p of parents) recipients.add(p.id);

  const rows = Array.from(recipients).map((userId) => ({
    userId,
    channel: "in_app" as const,
    title,
    body,
  }));
  if (rows.length) await db.insert(notifications).values(rows);
}

async function studentName(studentId: string): Promise<string> {
  const [s] = await db
    .select({ f: profiles.firstName, l: profiles.lastName })
    .from(profiles)
    .where(eq(profiles.id, studentId))
    .limit(1);
  return s ? `${s.f} ${s.l}`.trim() : "The student";
}

// --- Activity (undo surface) ------------------------------------------------

export type RescheduleActivity = {
  id: string;
  subjectName: string;
  fromLabel: string;
  toLabel: string;
  reason: string | null;
  createdAt: Date;
  targetLessonId: string | null;
};

/** The make-up a redeemed credit was spent on - surfaced under a blocked
 *  cancellation so the admin can see (and undo) what's holding the credit. */
export type RedemptionInfo = {
  creditId: string;
  lessonId: string;
  label: string;
  subjectName: string;
};

export type CancellationActivity = {
  id: string;
  subjectName: string;
  lessonLabel: string;
  reason: string | null;
  createdAt: Date;
  creditId: string | null;
  creditStatus: CreditStatus | null;
  /** Set only when the linked credit is redeemed: the make-up it paid for. */
  redemption: RedemptionInfo | null;
};

export type StudentActivity = {
  reschedules: RescheduleActivity[];
  cancellations: CancellationActivity[];
};

/** A student's approved reschedules + cancellations, most-recent first, with
 *  the labels + linked-credit status the admin undo surface needs. */
export async function getStudentActivity(
  studentId: string,
): Promise<StudentActivity> {
  const origLesson = alias(lessons, "orig_lesson");
  const origClass = alias(classes, "orig_class");
  const origSubject = alias(subjects, "orig_subject");
  const targetLesson = alias(lessons, "target_lesson");

  const reschedRows = await db
    .select({
      id: rescheduleRequests.id,
      reason: rescheduleRequests.reason,
      createdAt: rescheduleRequests.createdAt,
      targetLessonId: rescheduleRequests.targetLessonId,
      targetDate: rescheduleRequests.targetDate,
      targetStartTime: rescheduleRequests.targetStartTime,
      subjectName: origSubject.name,
      fromDate: origLesson.date,
      fromStart: origLesson.startTime,
      targetLessonDate: targetLesson.date,
      targetLessonStart: targetLesson.startTime,
    })
    .from(rescheduleRequests)
    .innerJoin(origLesson, eq(origLesson.id, rescheduleRequests.originalLessonId))
    .innerJoin(origClass, eq(origClass.id, origLesson.classId))
    .innerJoin(origSubject, eq(origSubject.id, origClass.subjectId))
    .leftJoin(targetLesson, eq(targetLesson.id, rescheduleRequests.targetLessonId))
    .where(
      and(
        eq(rescheduleRequests.studentId, studentId),
        eq(rescheduleRequests.status, "approved"),
      ),
    )
    .orderBy(desc(rescheduleRequests.createdAt));

  const reschedules: RescheduleActivity[] = reschedRows.map((r) => {
    let toLabel = "another session";
    if (r.targetLessonDate && r.targetLessonStart) {
      toLabel = `${formatDateLong(r.targetLessonDate)} ${formatTime(r.targetLessonStart)}`;
    } else if (r.targetDate && r.targetStartTime) {
      toLabel = `${formatDateLong(r.targetDate)} ${formatTime(r.targetStartTime)}`;
    }
    return {
      id: r.id,
      subjectName: r.subjectName,
      fromLabel: `${formatDateLong(r.fromDate)} ${formatTime(r.fromStart)}`,
      toLabel,
      reason: r.reason,
      createdAt: r.createdAt,
      targetLessonId: r.targetLessonId,
    };
  });

  // The make-up a redeemed credit was spent on (credit.redeemedOnLessonId),
  // aliased so it doesn't collide with the cancelled lesson's joins above.
  const redeemLesson = alias(lessons, "redeem_lesson");
  const redeemClass = alias(classes, "redeem_class");
  const redeemSubject = alias(subjects, "redeem_subject");

  const today = isoDate(new Date());
  const cancelRows = await db
    .select({
      id: lessonCancellations.id,
      reason: lessonCancellations.reason,
      createdAt: lessonCancellations.createdAt,
      creditId: lessonCancellations.creditId,
      subjectName: subjects.name,
      lessonDate: lessons.date,
      lessonStart: lessons.startTime,
      creditStatus: classCredits.status,
      creditExpiresAt: classCredits.expiresAt,
      redeemLessonId: classCredits.redeemedOnLessonId,
      redeemDate: redeemLesson.date,
      redeemStart: redeemLesson.startTime,
      redeemSubjectName: redeemSubject.name,
    })
    .from(lessonCancellations)
    .innerJoin(lessons, eq(lessons.id, lessonCancellations.lessonId))
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .leftJoin(classCredits, eq(classCredits.id, lessonCancellations.creditId))
    .leftJoin(redeemLesson, eq(redeemLesson.id, classCredits.redeemedOnLessonId))
    .leftJoin(redeemClass, eq(redeemClass.id, redeemLesson.classId))
    .leftJoin(redeemSubject, eq(redeemSubject.id, redeemClass.subjectId))
    .where(eq(lessonCancellations.studentId, studentId))
    .orderBy(desc(lessonCancellations.createdAt));

  const cancellations: CancellationActivity[] = cancelRows.map((r) => {
    const creditStatus =
      r.creditStatus && r.creditExpiresAt
        ? deriveCreditStatus(r.creditStatus, r.creditExpiresAt, today)
        : null;
    // Only redeemed credits point at a real make-up lesson worth surfacing.
    const redemption: RedemptionInfo | null =
      creditStatus === "redeemed" &&
      r.creditId &&
      r.redeemLessonId &&
      r.redeemDate &&
      r.redeemStart
        ? {
            creditId: r.creditId,
            lessonId: r.redeemLessonId,
            label: `${formatDateLong(r.redeemDate)} ${formatTime(r.redeemStart)}`,
            subjectName: r.redeemSubjectName ?? r.subjectName,
          }
        : null;
    return {
      id: r.id,
      subjectName: r.subjectName,
      lessonLabel: `${formatDateLong(r.lessonDate)} ${formatTime(r.lessonStart)}`,
      reason: r.reason,
      createdAt: r.createdAt,
      creditId: r.creditId,
      creditStatus,
      redemption,
    };
  });

  return { reschedules, cancellations };
}

// --- Allowance summary (for the profile card) -------------------------------

export type AllowanceSummary = {
  termId: string | null;
  termLabel: string | null;
  cancellationsUsed: number;
  reschedulesUsed: number;
  cancellationBonus: number;
  rescheduleBonus: number;
  cancellationCap: number;
  rescheduleCap: number;
};

/** Current-term usage + effective caps for one student. termId is null when
 *  today falls between terms (no allowance can be granted then). */
export async function getStudentAllowanceSummary(
  studentId: string,
): Promise<AllowanceSummary> {
  const term = resolveTerm(isoDate(new Date()), await getTerms());
  if (!term) {
    return {
      termId: null,
      termLabel: null,
      cancellationsUsed: 0,
      reschedulesUsed: 0,
      cancellationBonus: 0,
      rescheduleBonus: 0,
      cancellationCap: CANCEL_CAP,
      rescheduleCap: RESCHEDULE_CAP,
    };
  }

  const [cancellationsUsed, reschedulesUsed, bonus, termRow] = await Promise.all([
    getCancellationsUsed(studentId, term.id),
    getReschedulesUsed(studentId, term.id),
    getAllowanceBonus(studentId, term.id),
    db
      .select({ year: terms.year, termNumber: terms.termNumber })
      .from(terms)
      .where(eq(terms.id, term.id))
      .limit(1),
  ]);

  const label = termRow[0]
    ? `Term ${termRow[0].termNumber} ${termRow[0].year}`
    : null;

  return {
    termId: term.id,
    termLabel: label,
    cancellationsUsed,
    reschedulesUsed,
    cancellationBonus: bonus.cancellation,
    rescheduleBonus: bonus.reschedule,
    cancellationCap: CANCEL_CAP + bonus.cancellation,
    rescheduleCap: RESCHEDULE_CAP + bonus.reschedule,
  };
}

export type EnrolledSubject = { id: string; name: string };

/** Distinct subjects the student is actively enrolled in - the grantable set
 *  for an admin class credit. */
export async function getStudentEnrolledSubjects(
  studentId: string,
): Promise<EnrolledSubject[]> {
  const rows = await db
    .selectDistinct({ id: subjects.id, name: subjects.name })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        isNull(enrollments.withdrawnAt),
      ),
    );
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

// --- Admin grants -----------------------------------------------------------

/** Grant a class credit directly (no originating cancellation/reschedule),
 *  expiring at the current term's end. */
export async function grantCreditAsAdmin(p: {
  studentId: string;
  subjectId: string;
  grantedById: string;
}): Promise<{ ok: true; creditId: string } | { ok: false; error: string }> {
  const term = resolveTerm(isoDate(new Date()), await getTerms());
  if (!term) {
    return {
      ok: false,
      error: "There's no active term right now - a credit can't be granted.",
    };
  }

  // The subject must be one the student is actively enrolled in - a credit is
  // only redeemable against a lesson they actually attend.
  const [enrolled] = await db
    .select({ subjectId: subjects.id, name: subjects.name })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(
      and(
        eq(enrollments.studentId, p.studentId),
        eq(subjects.id, p.subjectId),
      ),
    )
    .limit(1);
  if (!enrolled) {
    return { ok: false, error: "That student isn't enrolled in that subject." };
  }

  const creditId = await grantCredit({
    studentId: p.studentId,
    subjectId: p.subjectId,
    termId: term.id,
    reason: "admin_grant",
    fromLessonId: null,
    grantedById: p.grantedById,
    expiresAt: term.endDate,
  });

  await logAdminAudit(db, {
    actorId: p.grantedById,
    action: "admin_grant_credit",
    tableName: "class_credits",
    newData: {
      creditId,
      studentId: p.studentId,
      subjectId: p.subjectId,
      termId: term.id,
    },
  });

  await notifyStudentAndParents(
    p.studentId,
    "Class credit added",
    `${await studentName(p.studentId)} was granted a ${enrolled.name} class credit by the office. It can be redeemed for a make-up lesson before ${formatDateLong(term.endDate)}.`,
  );

  return { ok: true, creditId };
}

/** Top up a student's per-term reschedule/cancellation allowance by `bonus`. */
export async function grantAllowance(p: {
  studentId: string;
  termId: string;
  kind: "reschedule" | "cancellation";
  bonus: number;
  grantedById: string;
  reason?: string;
}): Promise<void> {
  if (!Number.isInteger(p.bonus) || p.bonus < 1 || p.bonus > 10) {
    throw new RangeError("Allowance bonus must be a whole number from 1 to 10.");
  }
  await db.insert(allowanceAdjustments).values({
    studentId: p.studentId,
    termId: p.termId,
    kind: p.kind,
    bonus: p.bonus,
    grantedById: p.grantedById,
    reason: p.reason?.trim().slice(0, 2000) || null,
  });

  await logAdminAudit(db, {
    actorId: p.grantedById,
    action: "admin_grant_allowance",
    tableName: "allowance_adjustments",
    newData: {
      studentId: p.studentId,
      termId: p.termId,
      kind: p.kind,
      bonus: p.bonus,
    },
  });

  const label = p.kind === "reschedule" ? "reschedule" : "cancellation";
  const plural = p.bonus === 1 ? "" : "s";
  await notifyStudentAndParents(
    p.studentId,
    "Extra allowance granted",
    `${await studentName(p.studentId)} was granted ${p.bonus} extra ${label}${plural} for this term by the office.`,
  );
}

// --- Undo -------------------------------------------------------------------

/** Reverse an approved reschedule: delete the make-up lesson it created (which
 *  cascades that lesson's attendance), restore the student's attendance on the
 *  original lesson, and delete the request row - which returns their reschedule
 *  allowance automatically (the count is derived from the surviving rows). */
export async function undoReschedule(p: {
  rescheduleRequestId: string;
  adminId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const [req] = await db
    .select({
      id: rescheduleRequests.id,
      status: rescheduleRequests.status,
      studentId: rescheduleRequests.studentId,
      originalLessonId: rescheduleRequests.originalLessonId,
      targetLessonId: rescheduleRequests.targetLessonId,
    })
    .from(rescheduleRequests)
    .where(eq(rescheduleRequests.id, p.rescheduleRequestId))
    .limit(1);
  if (!req) return { ok: false, error: "Reschedule not found." };
  if (req.status !== "approved") {
    return { ok: false, error: "Only an approved reschedule can be undone." };
  }

  // Label the original lesson for the notification before anything is deleted.
  const [orig] = await db
    .select({
      subjectName: subjects.name,
      date: lessons.date,
      startTime: lessons.startTime,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(eq(lessons.id, req.originalLessonId))
    .limit(1);

  await db.transaction(async (tx) => {
    if (req.targetLessonId) {
      const [tl] = await tx
        .select({ status: lessons.status })
        .from(lessons)
        .where(eq(lessons.id, req.targetLessonId))
        .limit(1);
      if (tl?.status === "makeup") {
        // Pull this student's attendance off the make-up first, then delete
        // the make-up lesson ONLY if no other student is attending it - a group
        // switch can place a second student onto the same make-up lesson, and
        // deleting it would cascade-delete their attendance + request row.
        await tx
          .delete(attendance)
          .where(
            and(
              eq(attendance.lessonId, req.targetLessonId),
              eq(attendance.studentId, req.studentId),
            ),
          );
        const [otherAttendee] = await tx
          .select({ studentId: attendance.studentId })
          .from(attendance)
          .where(eq(attendance.lessonId, req.targetLessonId))
          .limit(1);
        if (!otherAttendee) {
          await tx.delete(lessons).where(eq(lessons.id, req.targetLessonId));
        }
      } else {
        // A group switch onto an existing lesson: only pull this student's
        // make-up attendance, never the lesson itself.
        await tx
          .delete(attendance)
          .where(
            and(
              eq(attendance.lessonId, req.targetLessonId),
              eq(attendance.studentId, req.studentId),
            ),
          );
      }
    }

    // Restore the student onto the original lesson by clearing the "absent"
    // mark the reschedule wrote.
    await tx
      .delete(attendance)
      .where(
        and(
          eq(attendance.lessonId, req.originalLessonId),
          eq(attendance.studentId, req.studentId),
          eq(attendance.status, "absent"),
        ),
      );

    await tx
      .delete(rescheduleRequests)
      .where(eq(rescheduleRequests.id, req.id));

    await logAdminAudit(tx, {
      actorId: p.adminId,
      action: "admin_undo_reschedule",
      tableName: "reschedule_requests",
      oldData: {
        rescheduleRequestId: req.id,
        studentId: req.studentId,
        originalLessonId: req.originalLessonId,
        targetLessonId: req.targetLessonId,
      },
    });
  });

  if (orig) {
    await notifyStudentAndParents(
      req.studentId,
      "Reschedule undone",
      `${await studentName(req.studentId)}'s reschedule of the ${orig.subjectName} lesson on ${formatDateLong(orig.date)} at ${formatTime(orig.startTime)} was undone by the office. They're back on the original lesson.`,
    );
  }
  return { ok: true };
}

/** Reverse a cancellation: delete its unredeemed credit, delete the
 *  cancellation record, and restore the student's attendance on the lesson.
 *  Blocked when the credit was already redeemed (a real make-up lesson exists
 *  for it - that must be undone first). */
export async function undoCancellation(p: {
  cancellationId: string;
  adminId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const [row] = await db
    .select({
      id: lessonCancellations.id,
      studentId: lessonCancellations.studentId,
      lessonId: lessonCancellations.lessonId,
      creditId: lessonCancellations.creditId,
      subjectName: subjects.name,
      lessonDate: lessons.date,
      lessonStart: lessons.startTime,
      creditStatus: classCredits.status,
    })
    .from(lessonCancellations)
    .innerJoin(lessons, eq(lessons.id, lessonCancellations.lessonId))
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .leftJoin(classCredits, eq(classCredits.id, lessonCancellations.creditId))
    .where(eq(lessonCancellations.id, p.cancellationId))
    .limit(1);
  if (!row) return { ok: false, error: "Cancellation not found." };
  if (row.creditStatus === "redeemed") {
    return {
      ok: false,
      error: "That credit has already been used - undo the redemption first.",
    };
  }

  try {
    await db.transaction(async (tx) => {
      if (row.creditId) {
        // Conditional delete inside the tx: if the credit was redeemed between
        // the check above and now, this deletes 0 rows - throw to roll the
        // whole undo back rather than orphan a make-up from its credit.
        const deleted = await tx
          .delete(classCredits)
          .where(
            and(
              eq(classCredits.id, row.creditId),
              ne(classCredits.status, "redeemed"),
            ),
          )
          .returning({ id: classCredits.id });
        if (deleted.length === 0) throw new CreditRedeemedDuringUndoError();
      }
      await tx
        .delete(lessonCancellations)
        .where(eq(lessonCancellations.id, row.id));
      await tx
        .delete(attendance)
        .where(
          and(
            eq(attendance.lessonId, row.lessonId),
            eq(attendance.studentId, row.studentId),
            eq(attendance.status, "absent"),
          ),
        );

      await logAdminAudit(tx, {
        actorId: p.adminId,
        action: "admin_undo_cancellation",
        tableName: "lesson_cancellations",
        oldData: {
          cancellationId: row.id,
          studentId: row.studentId,
          lessonId: row.lessonId,
          creditId: row.creditId,
        },
      });
    });
  } catch (err) {
    if (err instanceof CreditRedeemedDuringUndoError) {
      return {
        ok: false,
        error: "That credit has already been used - undo the redemption first.",
      };
    }
    throw err;
  }

  await notifyStudentAndParents(
    row.studentId,
    "Cancellation undone",
    `${await studentName(row.studentId)}'s cancellation of the ${row.subjectName} lesson on ${formatDateLong(row.lessonDate)} at ${formatTime(row.lessonStart)} was undone by the office. The class credit was removed and they're back on the lesson.`,
  );
  return { ok: true };
}

/** Reverse a credit redemption: flip the credit back to active and tear down
 *  the make-up lesson it paid for (the student's attendance always; the lesson
 *  itself only when no other student is on it). This is the "undo the
 *  redemption first" step that unblocks undoing a cancellation whose credit was
 *  spent. Reverses exactly what `redeemCreditIntoSlot` created. */
export async function undoRedemption(p: {
  creditId: string;
  adminId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const [credit] = await db
    .select({
      id: classCredits.id,
      status: classCredits.status,
      studentId: classCredits.studentId,
      redeemedOnLessonId: classCredits.redeemedOnLessonId,
      subjectName: subjects.name,
    })
    .from(classCredits)
    .innerJoin(subjects, eq(subjects.id, classCredits.subjectId))
    .where(eq(classCredits.id, p.creditId))
    .limit(1);
  if (!credit) return { ok: false, error: "Credit not found." };
  if (credit.status !== "redeemed" || !credit.redeemedOnLessonId) {
    return {
      ok: false,
      error: "That credit hasn't been redeemed, so there's no make-up to undo.",
    };
  }
  const makeupLessonId = credit.redeemedOnLessonId;

  // Label the make-up for the notification before it is deleted.
  const [makeup] = await db
    .select({ date: lessons.date, startTime: lessons.startTime })
    .from(lessons)
    .where(eq(lessons.id, makeupLessonId))
    .limit(1);

  try {
    await db.transaction(async (tx) => {
      // Flip the credit back to active FIRST, guarded on it still being
      // redeemed onto this same make-up. `redeemed_on_lesson_id` is
      // `on delete set null`, so clearing it before deleting the lesson keeps
      // the credit consistent. Zero rows -> a concurrent undo/redeem changed
      // it; throw to roll back.
      const restored = await tx
        .update(classCredits)
        .set({
          status: "active",
          redeemedOnLessonId: null,
          redeemedById: null,
          redeemedAt: null,
        })
        .where(
          and(
            eq(classCredits.id, credit.id),
            eq(classCredits.status, "redeemed"),
            eq(classCredits.redeemedOnLessonId, makeupLessonId),
          ),
        )
        .returning({ id: classCredits.id });
      if (restored.length === 0) throw new RedemptionChangedDuringUndoError();

      // Pull this student's attendance off the make-up, then delete the make-up
      // lesson only if no other student is attending it - a credit make-up is
      // normally single-student, but never cascade-delete a shared lesson.
      await tx
        .delete(attendance)
        .where(
          and(
            eq(attendance.lessonId, makeupLessonId),
            eq(attendance.studentId, credit.studentId),
          ),
        );
      const [otherAttendee] = await tx
        .select({ studentId: attendance.studentId })
        .from(attendance)
        .where(eq(attendance.lessonId, makeupLessonId))
        .limit(1);
      if (!otherAttendee) {
        await tx.delete(lessons).where(eq(lessons.id, makeupLessonId));
      }

      await logAdminAudit(tx, {
        actorId: p.adminId,
        action: "admin_undo_redemption",
        tableName: "class_credits",
        oldData: {
          creditId: credit.id,
          studentId: credit.studentId,
          redeemedOnLessonId: makeupLessonId,
        },
      });
    });
  } catch (err) {
    if (err instanceof RedemptionChangedDuringUndoError) {
      return {
        ok: false,
        error: "That make-up just changed - refresh and try again.",
      };
    }
    throw err;
  }

  if (makeup) {
    await notifyStudentAndParents(
      credit.studentId,
      "Make-up booking undone",
      `${await studentName(credit.studentId)}'s ${credit.subjectName} make-up on ${formatDateLong(makeup.date)} at ${formatTime(makeup.startTime)} was undone by the office. The class credit is available again.`,
    );
  }
  return { ok: true };
}
