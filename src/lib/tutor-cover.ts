import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  classes,
  lessons,
  notifications,
  profiles,
  subjects,
  tutorCoverRequests,
  tutorLeaveRequests,
  type UserRole,
} from "@/db/schema";
import { formatDateLong } from "@/lib/format";
import { ADMIN_TIERS } from "@/lib/roles";
import {
  hoursUntilLesson,
  melbourneDate,
  nextCoverUrgency,
  tutorCoverLessonDescription,
} from "@/lib/tutor-cover-rules";

const ADMIN_ROLES = ["admin", ...ADMIN_TIERS] as UserRole[];
const originalTutor = alias(profiles, "cover_original_tutor");
const replacementTutor = alias(profiles, "cover_replacement_tutor");
const leaveTutor = alias(profiles, "leave_tutor");

export async function getAdminRecipientIds(): Promise<string[]> {
  const rows = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(inArray(profiles.role, ADMIN_ROLES), eq(profiles.isActive, true)));
  return rows.map((row) => row.id);
}

type AdminNotificationInput = {
  title: string;
  body: string;
  href?: string;
};

export function adminNotificationValues(
  adminIds: string[],
  input: AdminNotificationInput,
) {
  return adminIds.map((userId) => ({
    userId,
    channel: "in_app" as const,
    title: input.title,
    body: input.body,
    href: input.href ?? "/admin/reschedules#tutor-cover",
  }));
}

function coverRows() {
  return db
    .select({
      id: tutorCoverRequests.id,
      lessonId: tutorCoverRequests.lessonId,
      leaveRequestId: tutorCoverRequests.leaveRequestId,
      originalTutorId: tutorCoverRequests.originalTutorId,
      replacementTutorId: tutorCoverRequests.replacementTutorId,
      reason: tutorCoverRequests.reason,
      status: tutorCoverRequests.status,
      claimedAt: tutorCoverRequests.claimedAt,
      alert48SentAt: tutorCoverRequests.alert48SentAt,
      alert24SentAt: tutorCoverRequests.alert24SentAt,
      createdAt: tutorCoverRequests.createdAt,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      lessonStatus: lessons.status,
      className: classes.name,
      subjectName: subjects.name,
      location: lessons.location,
      originalTutorFirst: originalTutor.firstName,
      originalTutorLast: originalTutor.lastName,
      replacementTutorFirst: replacementTutor.firstName,
      replacementTutorLast: replacementTutor.lastName,
    })
    .from(tutorCoverRequests)
    .innerJoin(lessons, eq(lessons.id, tutorCoverRequests.lessonId))
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(originalTutor, eq(originalTutor.id, tutorCoverRequests.originalTutorId))
    .leftJoin(
      replacementTutor,
      eq(replacementTutor.id, tutorCoverRequests.replacementTutorId),
    );
}

export type CoverBoardRow = Awaited<ReturnType<typeof getCoverBoardRows>>[number];

export async function getCoverBoardRows(now = new Date()) {
  const rows = await coverRows()
    .where(
      and(
        inArray(tutorCoverRequests.status, ["open", "claimed"]),
        gte(lessons.date, melbourneDate(now)),
        notInArray(lessons.status, ["cancelled", "rescheduled"]),
      ),
    )
    .orderBy(asc(lessons.date), asc(lessons.startTime));

  return rows
    .map((row) => ({
      ...row,
      hoursRemaining: hoursUntilLesson(row.date, row.startTime, now),
    }))
    .filter((row) => row.hoursRemaining > 0);
}

export async function getTutorCoverPageData(tutorId: string, now = new Date()) {
  const [board, leaveRequests] = await Promise.all([
    getCoverBoardRows(now),
    db
      .select()
      .from(tutorLeaveRequests)
      .where(eq(tutorLeaveRequests.tutorId, tutorId))
      .orderBy(desc(tutorLeaveRequests.createdAt))
      .limit(20),
  ]);

  return {
    open: board.filter((row) => row.status === "open"),
    claimedByMe: board.filter(
      (row) => row.status === "claimed" && row.replacementTutorId === tutorId,
    ),
    requestedByMe: board.filter((row) => row.originalTutorId === tutorId),
    leaveRequests,
  };
}

/** Lessons that can be reported absent from the schedule page. */
export async function getTutorAbsenceLessonOptions(
  tutorId: string,
  now = new Date(),
) {
  const rows = await db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      className: classes.name,
      subjectName: subjects.name,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .leftJoin(
      tutorCoverRequests,
      eq(tutorCoverRequests.lessonId, lessons.id),
    )
    .where(
      and(
        eq(lessons.tutorId, tutorId),
        gte(lessons.date, melbourneDate(now)),
        inArray(lessons.status, ["upcoming", "makeup"]),
        isNull(tutorCoverRequests.id),
      ),
    )
    .orderBy(asc(lessons.date), asc(lessons.startTime));

  return rows
    .map((row) => ({
      ...row,
      hoursRemaining: hoursUntilLesson(row.date, row.startTime, now),
    }))
    .filter((row) => row.hoursRemaining >= 48);
}

export async function getAdminCoverOverview(now = new Date()) {
  const [pendingLeaves, board, tutors] = await Promise.all([
    db
      .select({
        id: tutorLeaveRequests.id,
        tutorId: tutorLeaveRequests.tutorId,
        tutorFirst: leaveTutor.firstName,
        tutorLast: leaveTutor.lastName,
        startDate: tutorLeaveRequests.startDate,
        endDate: tutorLeaveRequests.endDate,
        reason: tutorLeaveRequests.reason,
        createdAt: tutorLeaveRequests.createdAt,
      })
      .from(tutorLeaveRequests)
      .innerJoin(leaveTutor, eq(leaveTutor.id, tutorLeaveRequests.tutorId))
      .where(eq(tutorLeaveRequests.status, "pending"))
      .orderBy(asc(tutorLeaveRequests.startDate)),
    getCoverBoardRows(now),
    db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
      })
      .from(profiles)
      .where(and(eq(profiles.role, "tutor"), eq(profiles.isActive, true)))
      .orderBy(asc(profiles.firstName), asc(profiles.lastName)),
  ]);

  return { pendingLeaves, board, tutors };
}

/** Pick up lessons generated after a leave request was originally approved. */
async function materializeApprovedLeaveCovers(now: Date): Promise<number> {
  const today = melbourneDate(now);
  const approvedLeaves = await db
    .select({
      id: tutorLeaveRequests.id,
      tutorId: tutorLeaveRequests.tutorId,
      startDate: tutorLeaveRequests.startDate,
      endDate: tutorLeaveRequests.endDate,
      reason: tutorLeaveRequests.reason,
    })
    .from(tutorLeaveRequests)
    .where(
      and(
        eq(tutorLeaveRequests.status, "approved"),
        gte(tutorLeaveRequests.endDate, today),
      ),
    );

  let materialized = 0;
  for (const leave of approvedLeaves) {
    const affected = (
      await db
        .select({
          id: lessons.id,
          date: lessons.date,
          startTime: lessons.startTime,
        })
        .from(lessons)
        .where(
          and(
            eq(lessons.tutorId, leave.tutorId),
            gte(lessons.date, leave.startDate),
            sql`${lessons.date} <= ${leave.endDate}`,
            inArray(lessons.status, ["upcoming", "makeup"]),
          ),
        )
    ).filter((lesson) => hoursUntilLesson(lesson.date, lesson.startTime, now) > 0);
    if (affected.length === 0) continue;

    const created = await db
      .insert(tutorCoverRequests)
      .values(
        affected.map((lesson) => ({
          lessonId: lesson.id,
          leaveRequestId: leave.id,
          originalTutorId: leave.tutorId,
          reason: leave.reason,
          status: "open" as const,
        })),
      )
      .onConflictDoNothing({ target: tutorCoverRequests.lessonId })
      .returning({ id: tutorCoverRequests.id });
    materialized += created.length;
  }
  return materialized;
}

function coverBody(row: {
  className: string;
  subjectName: string;
  date: string;
  startTime: string;
  endTime: string;
  originalTutorFirst: string;
  originalTutorLast: string;
}) {
  return (
    `${tutorCoverLessonDescription(row)}. ` +
    `Originally assigned to ${row.originalTutorFirst} ${row.originalTutorLast}.`
  );
}

/**
 * Idempotent escalation sweep. It is called by the secured daily cron and on
 * admin portal activity, which compensates for Hobby cron's once-daily cadence.
 */
export async function runTutorCoverReminders(now = new Date()) {
  const adminIds = await getAdminRecipientIds();
  if (adminIds.length === 0) return { sent: 0, expired: 0, materialized: 0 };

  const materialized = await materializeApprovedLeaveCovers(now);

  const rows = await coverRows().where(eq(tutorCoverRequests.status, "open"));
  let sent = 0;
  let expired = 0;

  for (const row of rows) {
    if (!(["upcoming", "makeup"] as string[]).includes(row.lessonStatus)) {
      await db
        .update(tutorCoverRequests)
        .set({ status: "cancelled", updatedAt: now })
        .where(
          and(
            eq(tutorCoverRequests.id, row.id),
            eq(tutorCoverRequests.status, "open"),
          ),
        );
      continue;
    }
    const urgency = nextCoverUrgency({
      hoursRemaining: hoursUntilLesson(row.date, row.startTime, now),
      alert48Sent: Boolean(row.alert48SentAt),
      alert24Sent: Boolean(row.alert24SentAt),
    });
    if (!urgency) continue;

    if (urgency === "expired") {
      const recorded = await db.transaction(async (tx) => {
        const changed = await tx
          .update(tutorCoverRequests)
          .set({ status: "expired", updatedAt: now })
          .where(
            and(
              eq(tutorCoverRequests.id, row.id),
              eq(tutorCoverRequests.status, "open"),
            ),
          )
          .returning({ id: tutorCoverRequests.id });
        if (changed.length === 0) return false;
        await tx.insert(notifications).values(
          adminIds.map((userId) => ({
            userId,
            channel: "in_app" as const,
            title: "URGENT: Class passed without cover",
            body: coverBody(row),
            href: "/admin/reschedules#tutor-cover",
          })),
        );
        return true;
      });
      if (!recorded) continue;
      expired += 1;
      sent += adminIds.length;
      continue;
    }

    const recorded = await db.transaction(async (tx) => {
      const changed = await tx
        .update(tutorCoverRequests)
        .set(
          urgency === "24h"
            ? {
                alert24SentAt: now,
                alert48SentAt: sql`coalesce(${tutorCoverRequests.alert48SentAt}, ${now})`,
                updatedAt: now,
              }
            : { alert48SentAt: now, updatedAt: now },
        )
        .where(
          and(
            eq(tutorCoverRequests.id, row.id),
            eq(tutorCoverRequests.status, "open"),
            urgency === "24h"
              ? isNull(tutorCoverRequests.alert24SentAt)
              : isNull(tutorCoverRequests.alert48SentAt),
          ),
        )
        .returning({ id: tutorCoverRequests.id });
      if (changed.length === 0) return false;
      await tx.insert(notifications).values(
        adminIds.map((userId) => ({
          userId,
          channel: "in_app" as const,
          title: `URGENT: Cover still needed within ${urgency}`,
          body: coverBody(row),
          href: "/admin/reschedules#tutor-cover",
        })),
      );
      return true;
    });
    if (!recorded) continue;
    sent += adminIds.length;
  }

  const today = melbourneDate(now);
  const uncoveredLeaves = await db
    .select({
      id: tutorLeaveRequests.id,
      tutorFirst: leaveTutor.firstName,
      tutorLast: leaveTutor.lastName,
      startDate: tutorLeaveRequests.startDate,
      endDate: tutorLeaveRequests.endDate,
      openCount: sql<number>`count(${tutorCoverRequests.id})::int`,
    })
    .from(tutorLeaveRequests)
    .innerJoin(leaveTutor, eq(leaveTutor.id, tutorLeaveRequests.tutorId))
    .innerJoin(
      tutorCoverRequests,
      and(
        eq(tutorCoverRequests.leaveRequestId, tutorLeaveRequests.id),
        eq(tutorCoverRequests.status, "open"),
      ),
    )
    .where(
      and(
        eq(tutorLeaveRequests.status, "approved"),
        gte(tutorLeaveRequests.endDate, today),
      ),
    )
    .groupBy(
      tutorLeaveRequests.id,
      leaveTutor.firstName,
      leaveTutor.lastName,
      tutorLeaveRequests.startDate,
      tutorLeaveRequests.endDate,
    );

  for (const leave of uncoveredLeaves) {
    const recorded = await db.transaction(async (tx) => {
      const changed = await tx
        .update(tutorLeaveRequests)
        .set({ lastUncoveredReminderOn: today, updatedAt: now })
        .where(
          and(
            eq(tutorLeaveRequests.id, leave.id),
            eq(tutorLeaveRequests.status, "approved"),
            or(
              isNull(tutorLeaveRequests.lastUncoveredReminderOn),
              lt(tutorLeaveRequests.lastUncoveredReminderOn, today),
            ),
          ),
        )
        .returning({ id: tutorLeaveRequests.id });
      if (changed.length === 0) return false;
      await tx.insert(notifications).values(
        adminIds.map((userId) => ({
          userId,
          channel: "in_app" as const,
          title: "URGENT: Extended leave is still not fully covered",
          body:
            `${leave.tutorFirst} ${leave.tutorLast} is away ` +
            `${formatDateLong(leave.startDate)}–${formatDateLong(leave.endDate)}. ` +
            `${leave.openCount} ${leave.openCount === 1 ? "class still needs" : "classes still need"} a replacement.`,
          href: "/admin/reschedules#tutor-cover",
        })),
      );
      return true;
    });
    if (!recorded) continue;
    sent += adminIds.length;
  }

  return { sent, expired, materialized };
}
