import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, subjectWeeks } from "@/db/schema";

/**
 * Tutors reach a quiz from its week in a class's week plan, so links back to
 * a quiz's home open that week. A quiz belongs to a subject week, not a class:
 * when the tutor teaches several classes in the subject, the first by name is
 * used. A tutor with no class in the subject falls back to their class list.
 */
export async function quizWeekPlanHrefs(
  tutorId: string,
  quizzes: Array<{ subjectId: string; subjectWeekId: string }>,
): Promise<Map<string, string>> {
  const hrefs = new Map<string, string>();
  if (quizzes.length === 0) return hrefs;
  const subjectIds = [...new Set(quizzes.map((q) => q.subjectId))];
  const weekIds = [...new Set(quizzes.map((q) => q.subjectWeekId))];

  const [classRows, weekRows] = await Promise.all([
    db
      .select({ id: classes.id, subjectId: classes.subjectId })
      .from(classes)
      .where(and(eq(classes.tutorId, tutorId), inArray(classes.subjectId, subjectIds)))
      .orderBy(asc(classes.name)),
    db
      .select({ id: subjectWeeks.id, termId: subjectWeeks.termId })
      .from(subjectWeeks)
      .where(inArray(subjectWeeks.id, weekIds)),
  ]);

  const classBySubject = new Map<string, string>();
  for (const row of classRows) {
    if (!classBySubject.has(row.subjectId)) classBySubject.set(row.subjectId, row.id);
  }
  const termByWeek = new Map(weekRows.map((row) => [row.id, row.termId]));

  for (const quiz of quizzes) {
    const classId = classBySubject.get(quiz.subjectId);
    const termId = termByWeek.get(quiz.subjectWeekId);
    hrefs.set(
      quiz.subjectWeekId,
      classId && termId
        ? `/tutor/classes/${classId}/curriculum?term=${termId}&week=${quiz.subjectWeekId}`
        : "/tutor/classes",
    );
  }
  return hrefs;
}
