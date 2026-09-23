import "server-only";

import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  lessons,
  notifications,
  profiles,
  subjects,
  tutorBankDetails,
  tutorCheckinEntries,
  tutorWeeklyCheckins,
} from "@/db/schema";
import { classDisplayName } from "@/lib/class-display";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import {
  addIsoDays,
  checkinMinutes,
  checkinPay,
  checkinReminderDay,
  weekStartForIsoDate,
} from "@/lib/tutor-checkin-rules";

export type TutorCheckinView = {
  id: string;
  tutorId: string;
  weekStart: string;
  status: "pending" | "approved" | "disputed";
  approvedAt: Date | null;
  disputeMessage: string | null;
  updatedAt: Date;
  entries: Array<typeof tutorCheckinEntries.$inferSelect>;
  totalMinutes: number;
  totalPay: number;
  hasMissingRate: boolean;
};

export type TutorCheckinMonthSummary = {
  tutorId: string;
  tutorName: string;
  approvedMinutes: number;
  approvedPay: number;
  pendingMinutes: number;
  pendingPay: number;
  approvedWeeks: number;
  pendingWeeks: number;
  hasMissingRate: boolean;
};

function checkinView(
  checkin: typeof tutorWeeklyCheckins.$inferSelect,
  entries: Array<typeof tutorCheckinEntries.$inferSelect>,
): TutorCheckinView {
  const active = entries.filter((entry) => !entry.isRemoved);
  return {
    ...checkin,
    entries,
    totalMinutes: active.reduce((sum, entry) => sum + entry.minutes, 0),
    totalPay: active.reduce(
      (sum, entry) => sum + checkinPay(entry.minutes, entry.hourlyRate),
      0,
    ),
    hasMissingRate: active.some((entry) => Number(entry.hourlyRate) <= 0),
  };
}

/**
 * Synchronise and load one week for several tutors in batches. The admin page
 * used to call the single-tutor path in parallel, producing multiple rounds of
 * select/insert/select traffic per tutor. Across a serverless-to-database
 * connection that made a simple navigation wait on dozens of requests.
 *
 * Approved snapshots remain immutable. Pending snapshots are reconciled with
 * the lesson timetable and current hourly rate before they are displayed.
 */
export async function getTutorCheckinWeeks(
  requestedTutorIds: string[],
  requestedWeek: string,
): Promise<TutorCheckinView[]> {
  const tutorIds = Array.from(new Set(requestedTutorIds));
  if (tutorIds.length === 0) return [];

  const weekStart = weekStartForIsoDate(requestedWeek);
  const weekEnd = addIsoDays(weekStart, 6);
  const loadCheckins = () =>
    db
      .select()
      .from(tutorWeeklyCheckins)
      .where(
        and(
          inArray(tutorWeeklyCheckins.tutorId, tutorIds),
          eq(tutorWeeklyCheckins.weekStart, weekStart),
        ),
      );

  let checkins = await loadCheckins();
  const existingTutorIds = new Set(checkins.map((row) => row.tutorId));
  const missingTutorIds = tutorIds.filter((id) => !existingTutorIds.has(id));
  if (missingTutorIds.length > 0) {
    await db
      .insert(tutorWeeklyCheckins)
      .values(missingTutorIds.map((tutorId) => ({ tutorId, weekStart })))
      .onConflictDoNothing();
    checkins = await loadCheckins();
  }

  const checkinByTutor = new Map(
    checkins.map((checkin) => [checkin.tutorId, checkin]),
  );
  if (checkinByTutor.size !== tutorIds.length) {
    throw new Error("Weekly check-ins could not be created.");
  }

  const checkinIds = checkins.map((checkin) => checkin.id);
  const mutableCheckins = checkins.filter(
    (checkin) => checkin.status !== "approved",
  );
  const mutableTutorIds = mutableCheckins.map((checkin) => checkin.tutorId);

  const lessonPromise =
    mutableTutorIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            tutorId: lessons.tutorId,
            lessonId: lessons.id,
            classId: classes.id,
            subjectName: subjects.name,
            className: classes.name,
            workDate: lessons.date,
            startTime: lessons.startTime,
            endTime: lessons.endTime,
          })
          .from(lessons)
          .innerJoin(classes, eq(classes.id, lessons.classId))
          .innerJoin(subjects, eq(subjects.id, classes.subjectId))
          .where(
            and(
              inArray(lessons.tutorId, mutableTutorIds),
              inArray(lessons.status, ["upcoming", "completed", "makeup"]),
              gte(lessons.date, weekStart),
              lte(lessons.date, weekEnd),
            ),
          );
  const ratePromise =
    mutableTutorIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            tutorId: tutorBankDetails.tutorId,
            hourlyRate: tutorBankDetails.hourlyRate,
          })
          .from(tutorBankDetails)
          .where(inArray(tutorBankDetails.tutorId, mutableTutorIds));

  const [lessonRows, existingEntries, rateRows] = await Promise.all([
    lessonPromise,
    db
      .select()
      .from(tutorCheckinEntries)
      .where(inArray(tutorCheckinEntries.checkinId, checkinIds))
      .orderBy(
        asc(tutorCheckinEntries.workDate),
        asc(tutorCheckinEntries.startTime),
      ),
    ratePromise,
  ]);

  const rateByTutor = new Map(
    rateRows.map((row) => [row.tutorId, row.hourlyRate ?? "0"]),
  );
  const existingByLesson = new Map(
    existingEntries
      .filter((entry) => entry.lessonId)
      .map((entry) => [
        `${entry.checkinId}:${entry.lessonId as string}`,
        entry,
      ]),
  );
  const activeLessonKeys = new Set<string>();
  const insertValues: Array<typeof tutorCheckinEntries.$inferInsert> = [];
  const updateValues: Array<{
    id: string;
    classId: string;
    subjectName: string;
    className: string;
    workDate: string;
    startTime: string;
    endTime: string;
    minutes: number;
    hourlyRate: string;
  }> = [];

  for (const lesson of lessonRows) {
    const checkin = checkinByTutor.get(lesson.tutorId);
    if (!checkin || checkin.status === "approved") continue;
    const key = `${checkin.id}:${lesson.lessonId}`;
    activeLessonKeys.add(key);
    const minutes = checkinMinutes(lesson.startTime, lesson.endTime);
    const hourlyRate = rateByTutor.get(lesson.tutorId) ?? "0";
    const existing = existingByLesson.get(key);
    if (!existing) {
      insertValues.push({
        checkinId: checkin.id,
        lessonId: lesson.lessonId,
        classId: lesson.classId,
        subjectName: lesson.subjectName,
        className: lesson.className,
        workDate: lesson.workDate,
        startTime: lesson.startTime,
        endTime: lesson.endTime,
        minutes,
        hourlyRate,
      });
      continue;
    }
    if (existing.isManualOverride) continue;
    const changed =
      existing.classId !== lesson.classId ||
      existing.subjectName !== lesson.subjectName ||
      existing.className !== lesson.className ||
      existing.workDate !== lesson.workDate ||
      existing.startTime !== lesson.startTime ||
      existing.endTime !== lesson.endTime ||
      existing.minutes !== minutes ||
      existing.hourlyRate !== hourlyRate ||
      existing.isRemoved;
    if (changed) {
      updateValues.push({
        id: existing.id,
        classId: lesson.classId,
        subjectName: lesson.subjectName,
        className: lesson.className,
        workDate: lesson.workDate,
        startTime: lesson.startTime,
        endTime: lesson.endTime,
        minutes,
        hourlyRate,
      });
    }
  }

  const mutableCheckinIds = new Set(
    mutableCheckins.map((checkin) => checkin.id),
  );
  const removeIds = existingEntries
    .filter(
      (entry) =>
        mutableCheckinIds.has(entry.checkinId) &&
        entry.lessonId &&
        !entry.isManualOverride &&
        !entry.isRemoved &&
        !activeLessonKeys.has(`${entry.checkinId}:${entry.lessonId}`),
    )
    .map((entry) => entry.id);

  const mutated =
    insertValues.length > 0 || updateValues.length > 0 || removeIds.length > 0;
  if (mutated) {
    await db.transaction(async (tx) => {
      if (insertValues.length > 0) {
        await tx
          .insert(tutorCheckinEntries)
          .values(insertValues)
          .onConflictDoNothing();
      }
      for (const entry of updateValues) {
        await tx
          .update(tutorCheckinEntries)
          .set({
            classId: entry.classId,
            subjectName: entry.subjectName,
            className: entry.className,
            workDate: entry.workDate,
            startTime: entry.startTime,
            endTime: entry.endTime,
            minutes: entry.minutes,
            hourlyRate: entry.hourlyRate,
            isRemoved: false,
            updatedAt: new Date(),
          })
          .where(eq(tutorCheckinEntries.id, entry.id));
      }
      if (removeIds.length > 0) {
        await tx
          .update(tutorCheckinEntries)
          .set({ isRemoved: true, updatedAt: new Date() })
          .where(inArray(tutorCheckinEntries.id, removeIds));
      }
    });
  }

  const entries = mutated
    ? await db
        .select()
        .from(tutorCheckinEntries)
        .where(inArray(tutorCheckinEntries.checkinId, checkinIds))
        .orderBy(
          asc(tutorCheckinEntries.workDate),
          asc(tutorCheckinEntries.startTime),
        )
    : existingEntries;
  const entriesByCheckin = new Map<
    string,
    Array<typeof tutorCheckinEntries.$inferSelect>
  >();
  for (const entry of entries) {
    const current = entriesByCheckin.get(entry.checkinId) ?? [];
    current.push(entry);
    entriesByCheckin.set(entry.checkinId, current);
  }

  return tutorIds.map((tutorId) => {
    const checkin = checkinByTutor.get(tutorId);
    if (!checkin) throw new Error("Weekly check-in could not be loaded.");
    return checkinView(checkin, entriesByCheckin.get(checkin.id) ?? []);
  });
}

export async function getTutorCheckinWeek(
  tutorId: string,
  requestedWeek: string,
): Promise<TutorCheckinView> {
  const [view] = await getTutorCheckinWeeks([tutorId], requestedWeek);
  if (!view) throw new Error("Weekly check-in could not be loaded.");
  return view;
}

/*
 * Payroll summary from durable weekly snapshots. A week contributes to
 * "owed" only after the tutor approves it; pending/disputed hours stay visible
 * separately so the owner can resolve them before payroll.
 */
export async function getTutorCheckinMonthSummary(
  month: string,
  filters: { tutorId?: string; classId?: string } = {},
): Promise<TutorCheckinMonthSummary[]> {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Use a valid month.");
  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) throw new Error("Use a valid month.");
  const monthStart = `${year}-${String(monthNumber).padStart(2, "0")}-01`;
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1));
  const monthEnd = addIsoDays(nextMonth.toISOString().slice(0, 10), -1);

  const rows = await db
    .select({
      tutorId: tutorWeeklyCheckins.tutorId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      weekStart: tutorWeeklyCheckins.weekStart,
      status: tutorWeeklyCheckins.status,
      minutes: tutorCheckinEntries.minutes,
      hourlyRate: tutorCheckinEntries.hourlyRate,
    })
    .from(tutorCheckinEntries)
    .innerJoin(
      tutorWeeklyCheckins,
      eq(tutorWeeklyCheckins.id, tutorCheckinEntries.checkinId),
    )
    .innerJoin(profiles, eq(profiles.id, tutorWeeklyCheckins.tutorId))
    .where(
      and(
        gte(tutorCheckinEntries.workDate, monthStart),
        lte(tutorCheckinEntries.workDate, monthEnd),
        eq(tutorCheckinEntries.isRemoved, false),
        filters.tutorId
          ? eq(tutorWeeklyCheckins.tutorId, filters.tutorId)
          : undefined,
        filters.classId
          ? eq(tutorCheckinEntries.classId, filters.classId)
          : undefined,
      ),
    )
    .orderBy(asc(profiles.firstName), asc(profiles.lastName));

  const summaries = new Map<
    string,
    TutorCheckinMonthSummary & {
      approvedWeekKeys: Set<string>;
      pendingWeekKeys: Set<string>;
    }
  >();
  for (const row of rows) {
    let summary = summaries.get(row.tutorId);
    if (!summary) {
      summary = {
        tutorId: row.tutorId,
        tutorName: `${row.firstName} ${row.lastName}`.trim(),
        approvedMinutes: 0,
        approvedPay: 0,
        pendingMinutes: 0,
        pendingPay: 0,
        approvedWeeks: 0,
        pendingWeeks: 0,
        hasMissingRate: false,
        approvedWeekKeys: new Set<string>(),
        pendingWeekKeys: new Set<string>(),
      };
      summaries.set(row.tutorId, summary);
    }
    const pay = checkinPay(row.minutes, row.hourlyRate);
    if (row.status === "approved") {
      summary.approvedMinutes += row.minutes;
      summary.approvedPay += pay;
      summary.approvedWeekKeys.add(row.weekStart);
    } else {
      summary.pendingMinutes += row.minutes;
      summary.pendingPay += pay;
      summary.pendingWeekKeys.add(row.weekStart);
    }
    if (Number(row.hourlyRate) <= 0) summary.hasMissingRate = true;
  }

  return Array.from(summaries.values()).map(
    ({ approvedWeekKeys, pendingWeekKeys, ...summary }) => ({
      ...summary,
      approvedPay: Math.round(summary.approvedPay * 100) / 100,
      pendingPay: Math.round(summary.pendingPay * 100) / 100,
      approvedWeeks: approvedWeekKeys.size,
      pendingWeeks: pendingWeekKeys.size,
    }),
  );
}

/** Creates missing current-week snapshots and sends retry-safe Saturday/Sunday
 * reminders. This shares the existing authenticated daily cron. */
export async function runTutorCheckinReminders(now = new Date()) {
  const today = melbourneDate(now);
  const reminderDay = checkinReminderDay(today);
  if (!reminderDay) {
    return { day: "none" as const, tutorNotifications: 0, adminNotifications: 0 };
  }
  const weekStart = weekStartForIsoDate(today);
  const tutors = await db
    .select({ id: profiles.id, firstName: profiles.firstName, lastName: profiles.lastName })
    .from(profiles)
    .where(and(eq(profiles.role, "tutor"), eq(profiles.isActive, true)));
  const owners =
    reminderDay === "sunday"
      ? await db
          .select({ id: profiles.id })
          .from(profiles)
          .where(
            and(
              inArray(profiles.role, ["admin", "admin_unrestricted"]),
              eq(profiles.isActive, true),
            ),
          )
      : [];
  const views = await getTutorCheckinWeeks(
    tutors.map((tutor) => tutor.id),
    weekStart,
  );

  const values: Array<typeof notifications.$inferInsert> = [];
  for (const [index, tutor] of tutors.entries()) {
    const view = views[index];
    if (!view) continue;
    if (view.status === "approved" || view.entries.every((entry) => entry.isRemoved)) {
      continue;
    }
    const marker = reminderDay;
    values.push({
      userId: tutor.id,
      channel: "in_app",
      title:
        reminderDay === "saturday"
          ? "Check your hours before Sunday"
          : "Weekly hours due today",
      body: "Review this week's lessons and approve your tutor check-in, or report anything that is wrong.",
      href: `/tutor/checkin?week=${weekStart}`,
      dedupeKey: `tutor-checkin:${tutor.id}:${weekStart}:${marker}`,
    });
    if (reminderDay === "sunday") {
      const tutorName = `${tutor.firstName} ${tutor.lastName}`.trim();
      for (const owner of owners) {
        values.push({
          userId: owner.id,
          channel: "in_app",
          title: "Tutor check-in not approved",
          body: `${tutorName} has not approved their hours for the week starting ${weekStart}.`,
          href: `/admin/tutor-checkins?week=${weekStart}&tutor=${tutor.id}`,
          dedupeKey: `tutor-checkin-admin:${tutor.id}:${weekStart}:sunday`,
        });
      }
    }
  }
  let inserted: Array<{ title: string }> = [];
  if (values.length > 0) {
    inserted = await db
      .insert(notifications)
      .values(values)
      .onConflictDoNothing()
      .returning({ title: notifications.title });
  }
  return {
    day: reminderDay,
    tutorNotifications: inserted.filter(
      (row) => row.title !== "Tutor check-in not approved",
    ).length,
    adminNotifications: inserted.filter(
      (row) => row.title === "Tutor check-in not approved",
    ).length,
  };
}

export function checkinEntryLabel(entry: {
  subjectName: string;
  className: string;
}) {
  return classDisplayName(entry.subjectName, entry.className);
}
