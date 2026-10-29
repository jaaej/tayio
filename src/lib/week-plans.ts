import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, subjectWeeks, terms } from "@/db/schema";
import { weekNumberOn } from "@/lib/week-plan-rules";

// The curriculum week a class's lesson falls in, for the tutor lesson page and
// the tutor Classes cards.

export type LessonWeek = {
  subjectWeekId: string;
  termId: string;
  weekNumber: number;
  title: string;
};

/**
 * The curriculum week a lesson on `isoDate` falls in, for that class's
 * subject. Null when the date is outside every term or the subject has no
 * week for it.
 */
export async function getLessonWeek(
  classId: string,
  isoDate: string,
): Promise<LessonWeek | null> {
  const [row] = await db
    .select({
      subjectId: classes.subjectId,
      termId: terms.id,
      termStart: terms.startDate,
    })
    .from(classes)
    .innerJoin(
      terms,
      and(lte(terms.startDate, isoDate), gte(terms.endDate, isoDate)),
    )
    .where(eq(classes.id, classId))
    .orderBy(asc(terms.startDate))
    .limit(1);
  if (!row) return null;

  const weekNumber = weekNumberOn(row.termStart, isoDate);
  const [week] = await db
    .select({
      id: subjectWeeks.id,
      weekNumber: subjectWeeks.weekNumber,
      title: subjectWeeks.title,
    })
    .from(subjectWeeks)
    .where(
      and(
        eq(subjectWeeks.subjectId, row.subjectId),
        eq(subjectWeeks.termId, row.termId),
        eq(subjectWeeks.weekNumber, weekNumber),
      ),
    )
    .limit(1);
  if (!week) return null;

  return {
    subjectWeekId: week.id,
    termId: row.termId,
    weekNumber: week.weekNumber,
    title: week.title,
  };
}
