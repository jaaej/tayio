import "server-only";

import { and, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, lessons } from "@/db/schema";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import {
  addIsoDays,
  RECURRING_LESSON_HORIZON_DAYS,
  weeklyDatesInRange,
} from "@/lib/recurring-lesson-rules";

type EnsureRecurringLessonsOptions = {
  classIds?: string[];
  fromIso?: string;
  throughIso?: string;
};

/**
 * Keep concrete timetable rows ahead of every recurring class pattern.
 * Existing rows of any status count as intentional calendar entries, so a
 * cancelled or otherwise edited week is never recreated by the sweep.
 */
export async function ensureRecurringLessons(
  options: EnsureRecurringLessonsOptions = {},
) {
  const fromIso = options.fromIso ?? melbourneDate(new Date());
  const throughIso =
    options.throughIso ?? addIsoDays(fromIso, RECURRING_LESSON_HORIZON_DAYS);

  const filters = [
    eq(classes.isRecurring, true),
    isNotNull(classes.weekday),
    isNotNull(classes.startTime),
    isNotNull(classes.endTime),
  ];
  if (options.classIds) {
    if (options.classIds.length === 0) {
      return { classesChecked: 0, lessonsCreated: 0, throughDate: throughIso };
    }
    filters.push(inArray(classes.id, options.classIds));
  }

  const recurring = await db
    .select({
      id: classes.id,
      tutorId: classes.tutorId,
      weekday: classes.weekday,
      startTime: classes.startTime,
      endTime: classes.endTime,
      location: classes.location,
      onlineLink: classes.onlineLink,
    })
    .from(classes)
    .where(and(...filters));

  let lessonsCreated = 0;
  for (const classRow of recurring) {
    if (
      classRow.weekday === null ||
      !classRow.startTime ||
      !classRow.endTime
    ) {
      continue;
    }

    const dates = weeklyDatesInRange({
      fromIso,
      throughIso,
      weekday: classRow.weekday,
    });
    if (dates.length === 0) continue;

    await db.transaction(async (tx) => {
      // Serialise all schedule generation for this class. This prevents the
      // create action and daily cron from inserting the same week together.
      await tx.execute(
        // Drizzle's parameterised template keeps the UUID out of SQL text.
        // hashtext gives PostgreSQL's advisory lock the integer key it needs.
        sql`select pg_advisory_xact_lock(hashtext(${classRow.id}))`,
      );

      const existing = await tx
        .select({ date: lessons.date })
        .from(lessons)
        .where(
          and(
            eq(lessons.classId, classRow.id),
            gte(lessons.date, fromIso),
            lte(lessons.date, throughIso),
          ),
        );
      const existingDates = new Set(existing.map((row) => row.date));
      const missing = dates.filter((date) => !existingDates.has(date));
      if (missing.length === 0) return;

      await tx.insert(lessons).values(
        missing.map((date) => ({
          classId: classRow.id,
          tutorId: classRow.tutorId,
          date,
          startTime: classRow.startTime!,
          endTime: classRow.endTime!,
          status: "upcoming" as const,
          location: classRow.location,
          onlineLink: classRow.onlineLink,
        })),
      );
      lessonsCreated += missing.length;
    });
  }

  return {
    classesChecked: recurring.length,
    lessonsCreated,
    throughDate: throughIso,
  };
}
