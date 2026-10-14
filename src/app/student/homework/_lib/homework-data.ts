import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, homework, homeworkAssignments, profiles, subjects } from "@/db/schema";
import type { HomeworkListItem } from "./homework-list";

export type StudentHomeworkListItem = HomeworkListItem & {
  isTest: boolean;
  /** The class tutor, so the page can offer to message them. Null for independent tasks. */
  tutorId: string | null;
  tutorFirstName: string | null;
};

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
      tutorId: classes.tutorId,
      tutorFirstName: profiles.firstName,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .leftJoin(classes, eq(classes.id, homework.classId))
    .leftJoin(subjects, eq(subjects.id, classes.subjectId))
    .leftJoin(profiles, eq(profiles.id, classes.tutorId))
    .where(eq(homeworkAssignments.studentId, studentId));

  return rows.map((r) => ({
    ...r,
    dueDate: r.dueDate.toISOString(),
    submittedAt: r.submittedAt?.toISOString() ?? null,
    markedAt: r.markedAt?.toISOString() ?? null,
  }));
}
