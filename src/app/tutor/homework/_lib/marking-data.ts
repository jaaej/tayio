import "server-only";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, homework, homeworkAssignments, profiles, subjects } from "@/db/schema";
import { classDisplayName } from "@/lib/class-display";
import { tutorHomeworkFilter } from "@/app/tutor/_lib/homework-access";
import {
  groupToMarkByClass,
  sortToMark,
  type HomeworkItem,
  type SubmissionItem,
} from "./marking-list";

/** How many recently marked submissions the Marked view lists. */
const MARKED_LIMIT = 60;

function submissionsQuery(tutorId: string, statuses: ("submitted" | "late" | "marked" | "returned" | "resubmission_requested")[]) {
  return db
    .select({
      homeworkId: homework.id,
      studentId: homeworkAssignments.studentId,
      homeworkTitle: homework.title,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      subjectName: subjects.name,
      subjectColor: subjects.color,
      classId: homework.classId,
      className: classes.name,
      status: homeworkAssignments.status,
      dueDate: homework.dueDate,
      submittedAt: homeworkAssignments.submittedAt,
      markedAt: homeworkAssignments.markedAt,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .leftJoin(classes, eq(classes.id, homework.classId))
    .leftJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, homeworkAssignments.studentId))
    .where(and(tutorHomeworkFilter(tutorId), inArray(homeworkAssignments.status, statuses)))
    .$dynamic();
}

type Row = Awaited<ReturnType<ReturnType<typeof submissionsQuery>["execute"]>>[number];

function toItem(r: Row): SubmissionItem {
  return {
    homeworkId: r.homeworkId,
    studentId: r.studentId,
    homeworkTitle: r.homeworkTitle,
    studentName: `${r.firstName} ${r.lastName}`.trim(),
    subjectName: r.subjectName,
    subjectColor: r.subjectColor,
    classId: r.classId,
    classLabel: r.className
      ? classDisplayName(r.subjectName, r.className)
      : null,
    status: r.status,
    dueDate: r.dueDate.toISOString(),
    submittedAt: r.submittedAt?.toISOString() ?? null,
    markedAt: r.markedAt?.toISOString() ?? null,
  };
}

/** Submissions waiting for this tutor in queue order: class by class, late
 *  work first then the oldest (`groupToMarkByClass`). */
export async function getToMark(tutorId: string): Promise<SubmissionItem[]> {
  const rows = await submissionsQuery(tutorId, ["submitted", "late"]);
  return groupToMarkByClass(sortToMark(rows.map(toItem))).flatMap((group) => group.items);
}

/** Everything the Marking list pane shows, in one round of queries. */
export async function getMarkingPaneData(tutorId: string) {
  const [toMark, markedRows, homeworkRows] = await Promise.all([
    getToMark(tutorId),
    submissionsQuery(tutorId, ["marked", "returned", "resubmission_requested"])
      .where(
        and(
          tutorHomeworkFilter(tutorId),
          inArray(homeworkAssignments.status, ["marked", "returned", "resubmission_requested"]),
          isNotNull(homeworkAssignments.markedAt),
        ),
      )
      .orderBy(desc(homeworkAssignments.markedAt))
      .limit(MARKED_LIMIT),
    db
      .select({
        id: homework.id,
        title: homework.title,
        dueDate: homework.dueDate,
        subjectName: subjects.name,
        subjectColor: subjects.color,
        className: classes.name,
        total: sql<number>`count(${homeworkAssignments.studentId})::int`,
        toMark: sql<number>`count(*) filter (where ${homeworkAssignments.status} in ('submitted', 'late'))::int`,
        marked: sql<number>`count(*) filter (where ${homeworkAssignments.status} in ('marked', 'returned'))::int`,
      })
      .from(homework)
      .leftJoin(classes, eq(classes.id, homework.classId))
      .leftJoin(subjects, eq(subjects.id, classes.subjectId))
      .leftJoin(homeworkAssignments, eq(homeworkAssignments.homeworkId, homework.id))
      .where(tutorHomeworkFilter(tutorId))
      .groupBy(homework.id, subjects.name, subjects.color, classes.name)
      .orderBy(desc(homework.dueDate)),
  ]);

  const homeworkItems: HomeworkItem[] = homeworkRows.map((h) => ({
    id: h.id,
    title: h.title,
    subjectName: h.subjectName,
    subjectColor: h.subjectColor,
    classLabel: h.className
      ? classDisplayName(h.subjectName, h.className)
      : null,
    dueDate: h.dueDate.toISOString(),
    toMark: h.toMark,
    marked: h.marked,
    total: h.total,
  }));

  return { toMark, marked: markedRows.map(toItem), homework: homeworkItems };
}
