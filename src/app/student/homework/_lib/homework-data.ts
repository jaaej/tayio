import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, homework, homeworkAssignments, subjects } from "@/db/schema";
import type { HomeworkListItem } from "./homework-list";

export type StudentHomeworkListItem = HomeworkListItem & { isTest: boolean };

/**
 * Every homework set for this student, shaped for the split view's list pane.
 * Scoped by `studentId` on the assignment row, so a student only ever sees
 * their own work.
 */
export async function getHomeworkListItems(studentId: string): Promise<StudentHomeworkListItem[]> {
  const rows = await db
    .select({
      id: homework.id,
      title: homework.title,
      dueDate: homework.dueDate,
      isTest: homework.isTest,
      status: homeworkAssignments.status,
      submittedAt: homeworkAssignments.submittedAt,
      markedAt: homeworkAssignments.markedAt,
      score: homeworkAssignments.score,
      className: classes.name,
      subjectName: subjects.name,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .leftJoin(classes, eq(classes.id, homework.classId))
    .leftJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(eq(homeworkAssignments.studentId, studentId));

  return rows.map((r) => ({
    ...r,
    dueDate: r.dueDate.toISOString(),
    submittedAt: r.submittedAt?.toISOString() ?? null,
    markedAt: r.markedAt?.toISOString() ?? null,
  }));
}
