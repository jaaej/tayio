import "server-only";
import { and, eq, gt, gte, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  attendance,
  classes,
  enrollments,
  familyLinks,
  lessons,
  notifications,
  profiles,
  rescheduleRequests,
  subjects,
} from "@/db/schema";
import { ADMIN_TIERS } from "@/lib/roles";
import {
  expandAvailability,
  markTakenSlots,
  type AvailableSlot,
} from "@/lib/availability";
import { formatDateLong, formatTime, isoDate } from "@/lib/format";
import { isCompatibleRescheduleTarget } from "@/lib/reschedule-rules";

const HOUR = 3600 * 1000;

/** An executor is either `db` directly or a `db.transaction(...)` callback's
 *  `tx` - both expose the same query-builder API, so writes can be pointed at
 *  whichever is in scope without duplicating call sites. */
type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ReschedulePath = "group_direct" | "approval";

export type ReschedulableLesson = {
  id: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  subjectYearLevel: string | null;
  className: string;
  tutorId: string;
  tutorName: string;
  date: string;
  startTime: string;
  endTime: string;
  classType: "group" | "one_on_one";
  capacity: number;
};

/** Which flow a reschedule takes. See the reschedule spec routing table. */
export function reschedulePath(
  lesson: { classType: string; date: string; startTime: string },
  now: Date,
): ReschedulePath {
  if (lesson.classType === "one_on_one") return "approval";
  const start = new Date(`${lesson.date}T${lesson.startTime}`);
  const hours = (start.getTime() - now.getTime()) / HOUR;
  return hours >= 24 ? "group_direct" : "approval";
}

export async function getReschedulableLesson(
  lessonId: string,
): Promise<ReschedulableLesson | null> {
  const [row] = await db
    .select({
      id: lessons.id,
      classId: lessons.classId,
      subjectId: classes.subjectId,
      subjectName: subjects.name,
      subjectYearLevel: subjects.yearLevel,
      className: classes.name,
      tutorId: lessons.tutorId,
      tutorFirst: profiles.firstName,
      tutorLast: profiles.lastName,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      classType: classes.classType,
      capacity: classes.capacity,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, lessons.tutorId))
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!row) return null;
  const { tutorFirst, tutorLast, ...rest } = row;
  return { ...rest, tutorName: `${tutorFirst} ${tutorLast}`.trim() };
}

/** Is the student the owner of this lesson (enrolled in its class)? */
export async function studentOwnsLesson(
  studentId: string,
  lessonId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: enrollments.classId })
    .from(lessons)
    .innerJoin(enrollments, eq(enrollments.classId, lessons.classId))
    .where(
      and(
        eq(lessons.id, lessonId),
        eq(enrollments.studentId, studentId),
        isNull(enrollments.withdrawnAt),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// --- Target selection -------------------------------------------------------

export type GroupTarget = {
  lessonId: string;
  className: string;
  tutorName: string;
  date: string;
  startTime: string;
  endTime: string;
  seatsLeft: number;
};

async function seatsLeftOn(
  classId: string,
  lessonId: string,
  capacity: number,
): Promise<number> {
  const [{ enrolled }] = await db
    .select({ enrolled: sql<number>`count(*)::int` })
    .from(enrollments)
    .where(and(eq(enrollments.classId, classId), isNull(enrollments.withdrawnAt)));
  const [{ makeups }] = await db
    .select({ makeups: sql<number>`count(*)::int` })
    .from(attendance)
    .where(
      and(
        eq(attendance.lessonId, lessonId),
        eq(attendance.status, "makeup_attended"),
      ),
    );
  return capacity - Number(enrolled) - Number(makeups);
}

/** Other same-subject group sessions that week with a spare seat. */
export async function getGroupSwitchTargets(
  original: ReschedulableLesson,
  now: Date,
): Promise<GroupTarget[]> {
  const orig = new Date(`${original.date}T00:00:00`);
  const dow = (orig.getDay() + 6) % 7; // Monday = 0
  const weekStart = new Date(orig);
  weekStart.setDate(orig.getDate() - dow);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const rows = await db
    .select({
      lessonId: lessons.id,
      classId: classes.id,
      className: classes.name,
      tutorFirst: profiles.firstName,
      tutorLast: profiles.lastName,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      capacity: classes.capacity,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(profiles, eq(profiles.id, lessons.tutorId))
    .where(
      and(
        eq(classes.subjectId, original.subjectId),
        eq(classes.classType, "group"),
        gte(lessons.date, isoDate(weekStart)),
        lt(lessons.date, isoDate(weekEnd)),
        ne(lessons.id, original.id),
        inArray(lessons.status, ["upcoming", "makeup"]),
      ),
    );

  const out: GroupTarget[] = [];
  for (const r of rows) {
    if (new Date(`${r.date}T${r.startTime}`).getTime() <= now.getTime()) continue;
    const seatsLeft = await seatsLeftOn(r.classId, r.lessonId, r.capacity);
    if (seatsLeft <= 0) continue;
    out.push({
      lessonId: r.lessonId,
      className: r.className,
      tutorName: `${r.tutorFirst} ${r.tutorLast}`.trim(),
      date: r.date,
      startTime: r.startTime,
      endTime: r.endTime,
      seatsLeft,
    });
  }
  out.sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
  );
  return out;
}

/** Same-tutor availability slots for a 1-on-1 reschedule. */
export async function getOneOnOneSlots(
  original: ReschedulableLesson,
  now: Date,
): Promise<AvailableSlot[]> {
  const [t] = await db
    .select({ firstName: profiles.firstName, lastName: profiles.lastName })
    .from(profiles)
    .where(eq(profiles.id, original.tutorId))
    .limit(1);
  const slots = await expandAvailability(
    [
      {
        id: original.tutorId,
        firstName: t?.firstName ?? "",
        lastName: t?.lastName ?? "",
        isOriginal: true,
      },
    ],
    now,
    4,
  );
  return markTakenSlots(slots);
}

// --- Execution primitives ---------------------------------------------------

function rescheduleNote(reason: string): string {
  return reason ? `Rescheduled: ${reason}` : "Rescheduled";
}

type ExecResult = { ok: true } | { ok: false; error: string };

type MakeupResult = { ok: true; lessonId: string } | { ok: false; error: string };

/** Reschedule to a tutor-availability slot: create a per-student makeup lesson
 *  with the same tutor and return its id. Used for every reschedule now. */
export async function executeMakeupReschedule(p: {
  studentId: string;
  originalLessonId: string;
  tutorId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
  actorId: string;
  pendingRequestId?: string;
}): Promise<MakeupResult> {
  const original = await getReschedulableLesson(p.originalLessonId);
  if (!original) return { ok: false, error: "Lesson not found" };
  if (p.tutorId !== original.tutorId) {
    return { ok: false, error: "The make-up must stay with the assigned tutor." };
  }
  if (p.startTime >= p.endTime ||
      new Date(`${p.date}T${p.startTime}`) <= new Date()) {
    return { ok: false, error: "Pick a future make-up time." };
  }

  return db.transaction(async (tx): Promise<MakeupResult> => {
    // Admin and self-serve moves use the same locks, so their updates to a
    // student's source lesson and to a tutor's diary cannot race each other.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`makeup:${p.studentId}:${p.originalLessonId}`}))`);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`makeup-tutor:${p.tutorId}:${p.date}`}))`);

    const [live] = await tx.select({
      status: lessons.status,
      date: lessons.date,
      startTime: lessons.startTime,
      rescheduledFrom: lessons.rescheduledFrom,
    }).from(lessons).where(eq(lessons.id, original.id)).limit(1);
    const [enrolled] = await tx.select({ id: enrollments.studentId })
      .from(enrollments).where(and(
        eq(enrollments.classId, original.classId),
        eq(enrollments.studentId, p.studentId),
        isNull(enrollments.withdrawnAt),
      )).limit(1);
    if (!live || !enrolled || live.status !== "upcoming" ||
        live.rescheduledFrom ||
        new Date(`${live.date}T${live.startTime}`) <= new Date()) {
      return { ok: false, error: "That original lesson can no longer be moved." };
    }

    if (p.pendingRequestId) {
      const [pending] = await tx.select({ id: rescheduleRequests.id })
        .from(rescheduleRequests).where(and(
          eq(rescheduleRequests.id, p.pendingRequestId),
          eq(rescheduleRequests.studentId, p.studentId),
          eq(rescheduleRequests.originalLessonId, original.id),
          eq(rescheduleRequests.status, "pending"),
        )).limit(1);
      if (!pending) return { ok: false, error: "Request already decided." };
    }

    const prior = await tx.select({
      id: rescheduleRequests.id,
      targetLessonId: rescheduleRequests.targetLessonId,
    }).from(rescheduleRequests).where(and(
      eq(rescheduleRequests.studentId, p.studentId),
      eq(rescheduleRequests.originalLessonId, original.id),
      eq(rescheduleRequests.status, "approved"),
    ));
    const priorLessonIds = prior
      .map((move) => move.targetLessonId)
      .filter((id): id is string => !!id);
    const clash = await tx.select({ id: lessons.id }).from(lessons).where(and(
      eq(lessons.tutorId, p.tutorId),
      eq(lessons.date, p.date),
      lt(lessons.startTime, p.endTime),
      gt(lessons.endTime, p.startTime),
      ne(lessons.status, "cancelled"),
      ne(lessons.status, "rescheduled"),
    ));
    if (clash.length) {
      // An identical retry should not create another booking or consume a
      // second token. Different overlapping slots remain unavailable.
      if (!p.pendingRequestId && clash.length === 1 &&
          priorLessonIds.includes(clash[0].id)) {
        const [same] = await tx.select({ id: lessons.id }).from(lessons)
          .where(and(
            eq(lessons.id, clash[0].id),
            eq(lessons.date, p.date),
            eq(lessons.startTime, p.startTime),
            eq(lessons.endTime, p.endTime),
            eq(lessons.tutorId, p.tutorId),
          )).limit(1);
        if (same) return { ok: true, lessonId: same.id };
      }
      return { ok: false, error: "That slot was just taken - pick another." };
    }

    for (const move of prior) {
      if (!move.targetLessonId) continue;
      await tx.delete(attendance).where(and(
        eq(attendance.lessonId, move.targetLessonId),
        eq(attendance.studentId, p.studentId),
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
    await tx.update(rescheduleRequests).set({ status: "cancelled" }).where(and(
      eq(rescheduleRequests.studentId, p.studentId),
      eq(rescheduleRequests.originalLessonId, original.id),
      inArray(rescheduleRequests.status, ["approved", "pending"]),
      p.pendingRequestId ? ne(rescheduleRequests.id, p.pendingRequestId) : undefined,
    ));
    await tx.delete(notifications).where(and(
      eq(notifications.href, `/admin/reschedules?r=${p.studentId}:${original.id}`),
      eq(notifications.title, "Reschedule request"),
    ));

    const [newLesson] = await tx.insert(lessons).values({
      classId: original.classId,
      tutorId: p.tutorId,
      date: p.date,
      startTime: p.startTime,
      endTime: p.endTime,
      status: "makeup",
      rescheduledFrom: original.id,
    }).returning({ id: lessons.id });
    await markStudentAbsent(original.id, p.studentId, p.reason, p.actorId, tx);
    await tx.insert(attendance).values({
      lessonId: newLesson.id,
      studentId: p.studentId,
      status: "makeup_attended",
      note: rescheduleNote(p.reason),
      markedBy: p.actorId,
    });
    if (p.pendingRequestId) {
      await tx.update(rescheduleRequests).set({
        status: "approved",
        targetLessonId: newLesson.id,
        decidedById: p.actorId,
        decidedAt: new Date(),
      }).where(eq(rescheduleRequests.id, p.pendingRequestId));
    } else {
      await tx.insert(rescheduleRequests).values({
        originalLessonId: original.id,
        studentId: p.studentId,
        requestedById: p.actorId,
        reason: p.reason || null,
        status: "approved",
        targetTutorId: p.tutorId,
        targetDate: p.date,
        targetStartTime: p.startTime,
        targetEndTime: p.endTime,
        targetLessonId: newLesson.id,
        decidedById: p.actorId,
        decidedAt: new Date(),
      });
    }

    const [student] = await tx.select({
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    }).from(profiles).where(eq(profiles.id, p.studentId)).limit(1);
    const parentIds = await tx.select({ id: familyLinks.parentId })
      .from(familyLinks).where(eq(familyLinks.studentId, p.studentId));
    const adminIds = await tx.select({ id: profiles.id }).from(profiles)
      .where(and(inArray(profiles.role, ADMIN_TIERS), eq(profiles.isActive, true)));
    const recipients = new Map<string, string>([
      [p.studentId, "/student/timetable"],
      [original.tutorId, `/tutor/lessons/${newLesson.id}`],
    ]);
    for (const parent of parentIds) recipients.set(parent.id, "/parent/classes");
    for (const admin of adminIds) recipients.set(admin.id, `/admin/users/${p.studentId}`);
    const studentName = student
      ? `${student.firstName} ${student.lastName}`.trim()
      : "A student";
    const body =
      `${studentName}'s ${original.subjectName} lesson on ` +
      `${formatDateLong(original.date)} at ${formatTime(original.startTime)} ` +
      `→ moved to ${formatDateLong(p.date)} ` +
      `${formatTime(p.startTime)}–${formatTime(p.endTime)}.` +
      (p.reason ? ` Reason: ${p.reason}` : "");
    await tx.insert(notifications).values(Array.from(recipients, ([userId, href]) => ({
      userId,
      channel: "in_app" as const,
      title: "Lesson rescheduled",
      body,
      href,
    })));
    return { ok: true, lessonId: newLesson.id };
  });
}

/** Group: move the student's attendance onto an existing target lesson.
 *  (Retained for compatibility; the current flow uses executeMakeupReschedule.) */
export async function executeSessionSwitch(p: {
  studentId: string;
  originalLessonId: string;
  targetLessonId: string;
  reason: string;
  actorId: string;
}): Promise<ExecResult> {
  const original = await getReschedulableLesson(p.originalLessonId);
  const target = await getReschedulableLesson(p.targetLessonId);
  if (!original || !target) return { ok: false, error: "Lesson not found" };

  if (!isCompatibleRescheduleTarget(original, target)) {
    return {
      ok: false,
      error: "The make-up class must have the same subject and year level.",
    };
  }
  if (original.id === target.id || target.classType !== "group") {
    return { ok: false, error: "Pick another eligible group class." };
  }

  if ((await seatsLeftOn(target.classId, target.id, target.capacity)) <= 0) {
    return { ok: false, error: "That session just filled up - pick another." };
  }

  await markStudentAbsent(original.id, p.studentId, p.reason, p.actorId);
  await db
    .insert(attendance)
    .values({
      lessonId: target.id,
      studentId: p.studentId,
      status: "makeup_attended",
      note: rescheduleNote(p.reason),
      markedBy: p.actorId,
    })
    .onConflictDoUpdate({
      target: [attendance.lessonId, attendance.studentId],
      set: {
        status: "makeup_attended",
        note: rescheduleNote(p.reason),
        markedBy: p.actorId,
        markedAt: new Date(),
      },
    });

  await notifyReschedule({
    studentId: p.studentId,
    original,
    newTutorId: target.tutorId,
    newDate: target.date,
    newStart: target.startTime,
    newEnd: target.endTime,
    reason: p.reason,
  });
  return { ok: true };
}

/**
 * Has this student already rescheduled this lesson (pending or approved)? If so
 * the next reschedule always needs approval, even for a group ≥24h move.
 */
export async function hasPriorReschedule(
  studentId: string,
  originalLessonId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: rescheduleRequests.id })
    .from(rescheduleRequests)
    .where(
      and(
        eq(rescheduleRequests.originalLessonId, originalLessonId),
        eq(rescheduleRequests.studentId, studentId),
        inArray(rescheduleRequests.status, ["approved", "pending"]),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function markStudentAbsent(
  lessonId: string,
  studentId: string,
  reason: string,
  actorId: string,
  executor: DbExecutor = db,
) {
  await executor
    .insert(attendance)
    .values({
      lessonId,
      studentId,
      status: "absent",
      note: rescheduleNote(reason),
      markedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [attendance.lessonId, attendance.studentId],
      set: {
        status: "absent",
        note: rescheduleNote(reason),
        markedBy: actorId,
        markedAt: new Date(),
      },
    });
}

export async function studentDisplayName(studentId: string): Promise<string> {
  const [s] = await db
    .select({ f: profiles.firstName, l: profiles.lastName })
    .from(profiles)
    .where(eq(profiles.id, studentId))
    .limit(1);
  return s ? `${s.f} ${s.l}`.trim() : "A student";
}

export async function getAdminIds(): Promise<string[]> {
  const rows = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(inArray(profiles.role, ADMIN_TIERS));
  return rows.map((r) => r.id);
}

async function notifyReschedule(o: {
  studentId: string;
  original: ReschedulableLesson;
  newTutorId: string;
  newDate: string;
  newStart: string;
  newEnd: string;
  reason: string;
}) {
  const recipients = new Set<string>([o.original.tutorId, o.newTutorId]);
  const parents = await db
    .select({ id: familyLinks.parentId })
    .from(familyLinks)
    .where(eq(familyLinks.studentId, o.studentId));
  for (const p of parents) recipients.add(p.id);
  for (const a of await getAdminIds()) recipients.add(a);

  const name = await studentDisplayName(o.studentId);
  const body =
    `${name}'s ${o.original.subjectName} lesson on ` +
    `${formatDateLong(o.original.date)} at ${formatTime(o.original.startTime)} ` +
    `→ moved to ${formatDateLong(o.newDate)} ` +
    `${formatTime(o.newStart)}–${formatTime(o.newEnd)}.` +
    (o.reason ? ` Reason: ${o.reason}` : "");
  const rows = Array.from(recipients).map((userId) => ({
    userId,
    channel: "in_app" as const,
    title: "Lesson rescheduled",
    body,
  }));
  if (rows.length) await db.insert(notifications).values(rows);
}

// --- Requests ---------------------------------------------------------------

export type RescheduleTarget =
  | { kind: "makeup"; tutorId: string; date: string; startTime: string; endTime: string }
  | { kind: "switch"; lessonId: string };

export async function createRescheduleRequest(p: {
  studentId: string;
  requestedById: string;
  originalLessonId: string;
  reason: string;
  target: RescheduleTarget;
}): Promise<string> {
  // Only the LATEST attempt to move this lesson should be pending. Supersede any
  // earlier PENDING request for THIS student + THIS lesson (never approved rows,
  // never other students/lessons) and drop their stale approval notifications.
  const notifHref = `/admin/reschedules?r=${p.studentId}:${p.originalLessonId}`;
  await db
    .delete(rescheduleRequests)
    .where(
      and(
        eq(rescheduleRequests.originalLessonId, p.originalLessonId),
        eq(rescheduleRequests.studentId, p.studentId),
        eq(rescheduleRequests.status, "pending"),
      ),
    );
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.href, notifHref),
        eq(notifications.title, "Reschedule request"),
      ),
    );

  const [req] = await db
    .insert(rescheduleRequests)
    .values({
      originalLessonId: p.originalLessonId,
      studentId: p.studentId,
      requestedById: p.requestedById,
      reason: p.reason || null,
      status: "pending",
      targetTutorId: p.target.kind === "makeup" ? p.target.tutorId : null,
      targetDate: p.target.kind === "makeup" ? p.target.date : null,
      targetStartTime: p.target.kind === "makeup" ? p.target.startTime : null,
      targetEndTime: p.target.kind === "makeup" ? p.target.endTime : null,
      targetLessonId: p.target.kind === "switch" ? p.target.lessonId : null,
    })
    .returning({ id: rescheduleRequests.id });

  const original = await getReschedulableLesson(p.originalLessonId);
  const recipients = new Set<string>();
  if (original) recipients.add(original.tutorId);
  for (const a of await getAdminIds()) recipients.add(a);
  const name = await studentDisplayName(p.studentId);
  const body =
    `${name} requested to reschedule their ${original?.subjectName ?? ""} lesson` +
    (original ? ` on ${formatDateLong(original.date)}` : "") +
    "." +
    (p.reason ? ` Reason: ${p.reason}` : "");
  const rows = Array.from(recipients).map((userId) => ({
    userId,
    channel: "in_app" as const,
    title: "Reschedule request",
    body,
    href: notifHref,
  }));
  if (rows.length) await db.insert(notifications).values(rows);
  return req.id;
}

/**
 * Durable record for a direct (no-approval) group switch, so the move shows up
 * on timetables + attendance the same way an approved request does.
 */
export async function recordDirectSwitch(p: {
  studentId: string;
  requestedById: string;
  originalLessonId: string;
  targetLessonId: string;
  reason: string;
}) {
  await db.insert(rescheduleRequests).values({
    originalLessonId: p.originalLessonId,
    studentId: p.studentId,
    requestedById: p.requestedById,
    reason: p.reason || null,
    status: "approved",
    targetLessonId: p.targetLessonId,
    decidedById: p.requestedById,
    decidedAt: new Date(),
  });
}

export type LessonRescheduleInfo = {
  movedOut: { studentId: string; studentName: string; toLabel: string }[];
  movedIn: {
    studentId: string;
    studentName: string;
    firstName: string;
    lastName: string;
    fromLabel: string;
    attendanceStatus:
      | "present"
      | "absent"
      | "late"
      | "left_early"
      | "makeup_attended"
      | null;
    attendanceNote: string | null;
  }[];
};

/** For an attendance/lesson view: who rescheduled OUT of this lesson (and to
 *  where) and who is attending as a make-up IN (and from where). */
export async function getLessonReschedules(
  lessonId: string,
): Promise<LessonRescheduleInfo> {
  const outRows = await db
    .select({
      studentId: rescheduleRequests.studentId,
      sf: profiles.firstName,
      sl: profiles.lastName,
      targetLessonId: rescheduleRequests.targetLessonId,
      targetDate: rescheduleRequests.targetDate,
      targetStart: rescheduleRequests.targetStartTime,
    })
    .from(rescheduleRequests)
    .innerJoin(profiles, eq(profiles.id, rescheduleRequests.studentId))
    .where(
      and(
        eq(rescheduleRequests.originalLessonId, lessonId),
        eq(rescheduleRequests.status, "approved"),
      ),
    );
  const movedOut: LessonRescheduleInfo["movedOut"] = [];
  for (const r of outRows) {
    let toLabel = "-";
    if (r.targetLessonId) {
      const t = await getReschedulableLesson(r.targetLessonId);
      toLabel = t
        ? `${t.className} · ${formatDateLong(t.date)} ${formatTime(t.startTime)}`
        : "another session";
    } else if (r.targetDate && r.targetStart) {
      toLabel = `${formatDateLong(r.targetDate)} ${formatTime(r.targetStart)}`;
    }
    movedOut.push({
      studentId: r.studentId,
      studentName: `${r.sf} ${r.sl}`.trim(),
      toLabel,
    });
  }

  const inRows = await db
    .select({
      studentId: rescheduleRequests.studentId,
      sf: profiles.firstName,
      sl: profiles.lastName,
      originalLessonId: rescheduleRequests.originalLessonId,
      attendanceStatus: attendance.status,
      attendanceNote: attendance.note,
    })
    .from(rescheduleRequests)
    .innerJoin(profiles, eq(profiles.id, rescheduleRequests.studentId))
    .leftJoin(
      attendance,
      and(
        eq(attendance.lessonId, lessonId),
        eq(attendance.studentId, rescheduleRequests.studentId),
      ),
    )
    .where(
      and(
        eq(rescheduleRequests.targetLessonId, lessonId),
        eq(rescheduleRequests.status, "approved"),
      ),
    );
  const movedIn: LessonRescheduleInfo["movedIn"] = [];
  for (const r of inRows) {
    const o = await getReschedulableLesson(r.originalLessonId);
    movedIn.push({
      studentId: r.studentId,
      studentName: `${r.sf} ${r.sl}`.trim(),
      firstName: r.sf,
      lastName: r.sl,
      fromLabel: o
        ? `${o.className} · ${formatDateLong(o.date)} ${formatTime(o.startTime)}`
        : "another session",
      attendanceStatus: r.attendanceStatus,
      attendanceNote: r.attendanceNote,
    });
  }
  return { movedOut, movedIn };
}

export async function approveRescheduleRequest(
  id: string,
  deciderId: string,
): Promise<ExecResult> {
  const [req] = await db
    .select()
    .from(rescheduleRequests)
    .where(eq(rescheduleRequests.id, id))
    .limit(1);
  if (!req) return { ok: false, error: "Request not found" };
  if (req.status !== "pending") return { ok: false, error: "Already decided" };

  // Makeup (tutor-availability) requests carry targetTutorId; execute + link the
  // newly-created makeup lesson back onto the request.
  if (
    req.targetTutorId &&
    req.targetDate &&
    req.targetStartTime &&
    req.targetEndTime
  ) {
    const res = await executeMakeupReschedule({
      studentId: req.studentId,
      originalLessonId: req.originalLessonId,
      tutorId: req.targetTutorId,
      date: req.targetDate,
      startTime: req.targetStartTime,
      endTime: req.targetEndTime,
      reason: req.reason ?? "",
      actorId: deciderId,
      pendingRequestId: id,
    });
    if (!res.ok) return res;
    return { ok: true };
  } else if (req.targetLessonId) {
    const res = await executeSessionSwitch({
      studentId: req.studentId,
      originalLessonId: req.originalLessonId,
      targetLessonId: req.targetLessonId,
      reason: req.reason ?? "",
      actorId: deciderId,
    });
    if (!res.ok) return res;
  } else {
    return { ok: false, error: "Malformed request" };
  }

  await db
    .update(rescheduleRequests)
    .set({ status: "approved", decidedById: deciderId, decidedAt: new Date() })
    .where(eq(rescheduleRequests.id, id));
  return { ok: true };
}

export async function rejectRescheduleRequest(
  id: string,
  deciderId: string,
  reason?: string,
): Promise<ExecResult> {
  const [req] = await db
    .select()
    .from(rescheduleRequests)
    .where(eq(rescheduleRequests.id, id))
    .limit(1);
  if (!req) return { ok: false, error: "Request not found" };
  if (req.status !== "pending") return { ok: false, error: "Already decided" };

  await db
    .update(rescheduleRequests)
    .set({ status: "rejected", decidedById: deciderId, decidedAt: new Date() })
    .where(eq(rescheduleRequests.id, id));
  await db.insert(notifications).values({
    userId: req.requestedById,
    channel: "in_app",
    title: "Reschedule declined",
    body: reason
      ? `Your reschedule request was declined: ${reason}`
      : "Your reschedule request was declined.",
  });
  return { ok: true };
}

export type PendingRequest = {
  id: string;
  studentName: string;
  subjectName: string;
  fromLabel: string;
  toLabel: string;
  reason: string | null;
  createdAt: Date;
};

/** Pending requests. Pass a tutorId to scope to that tutor's classes. */
export async function listPendingRequests(opts: {
  tutorId?: string;
}): Promise<PendingRequest[]> {
  const rows = await db
    .select({
      id: rescheduleRequests.id,
      reason: rescheduleRequests.reason,
      createdAt: rescheduleRequests.createdAt,
      targetTutorId: rescheduleRequests.targetTutorId,
      targetDate: rescheduleRequests.targetDate,
      targetStartTime: rescheduleRequests.targetStartTime,
      targetLessonId: rescheduleRequests.targetLessonId,
      studentFirst: profiles.firstName,
      studentLast: profiles.lastName,
      subjectName: subjects.name,
      classTutorId: classes.tutorId,
      fromDate: lessons.date,
      fromStart: lessons.startTime,
    })
    .from(rescheduleRequests)
    .innerJoin(lessons, eq(lessons.id, rescheduleRequests.originalLessonId))
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, rescheduleRequests.studentId))
    .where(
      and(
        eq(rescheduleRequests.status, "pending"),
        opts.tutorId ? eq(classes.tutorId, opts.tutorId) : undefined,
      ),
    );

  const out: PendingRequest[] = [];
  for (const r of rows) {
    let toLabel: string;
    if (r.targetLessonId) {
      const target = await getReschedulableLesson(r.targetLessonId);
      toLabel = target
        ? `${formatDateLong(target.date)} ${formatTime(target.startTime)} · ${target.tutorName}`
        : "another session";
    } else if (r.targetDate && r.targetStartTime) {
      toLabel = `${formatDateLong(r.targetDate)} ${formatTime(r.targetStartTime)}`;
    } else {
      toLabel = "-";
    }
    out.push({
      id: r.id,
      studentName: `${r.studentFirst} ${r.studentLast}`.trim(),
      subjectName: r.subjectName,
      fromLabel: `${formatDateLong(r.fromDate)} ${formatTime(r.fromStart)}`,
      toLabel,
      reason: r.reason,
      createdAt: r.createdAt,
    });
  }
  out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return out;
}
