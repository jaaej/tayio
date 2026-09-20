import "server-only";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  classes,
  classMoveRequests,
  enrollments,
  profiles,
  subjects,
} from "@/db/schema";
import { classDisplayName } from "@/lib/class-display";
import { classScheduleLabel } from "@/lib/class-move-rules";

export type ClassMoveOption = {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
  tutorName: string;
  weekday: number | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  capacity: number;
  enrolled: number;
  isCurrent: boolean;
  label: string;
  scheduleLabel: string;
};

export type ClassMoveHistoryRow = {
  id: string;
  studentId: string;
  requestedById: string;
  requestedByName: string;
  fromClassId: string;
  fromLabel: string;
  fromSchedule: string;
  toClassId: string;
  toLabel: string;
  toSchedule: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  createdAt: Date;
  decidedAt: Date | null;
};

export type ClassMoveData = {
  classes: ClassMoveOption[];
  requests: ClassMoveHistoryRow[];
};

export async function getClassMoveHistory(
  studentId: string,
): Promise<ClassMoveHistoryRow[]> {
  const fromClass = alias(classes, "move_from_class");
  const toClass = alias(classes, "move_to_class");
  const fromSubject = alias(subjects, "move_from_subject");
  const toSubject = alias(subjects, "move_to_subject");
  const requester = alias(profiles, "move_requester");

  const rows = await db
    .select({
      id: classMoveRequests.id,
      studentId: classMoveRequests.studentId,
      requestedById: classMoveRequests.requestedById,
      requesterFirst: requester.firstName,
      requesterLast: requester.lastName,
      fromClassId: fromClass.id,
      fromClassName: fromClass.name,
      fromSubjectName: fromSubject.name,
      fromWeekday: fromClass.weekday,
      fromStartTime: fromClass.startTime,
      fromEndTime: fromClass.endTime,
      toClassId: toClass.id,
      toClassName: toClass.name,
      toSubjectName: toSubject.name,
      toWeekday: toClass.weekday,
      toStartTime: toClass.startTime,
      toEndTime: toClass.endTime,
      reason: classMoveRequests.reason,
      status: classMoveRequests.status,
      createdAt: classMoveRequests.createdAt,
      decidedAt: classMoveRequests.decidedAt,
    })
    .from(classMoveRequests)
    .innerJoin(fromClass, eq(fromClass.id, classMoveRequests.fromClassId))
    .innerJoin(toClass, eq(toClass.id, classMoveRequests.toClassId))
    .innerJoin(fromSubject, eq(fromSubject.id, fromClass.subjectId))
    .innerJoin(toSubject, eq(toSubject.id, toClass.subjectId))
    .innerJoin(requester, eq(requester.id, classMoveRequests.requestedById))
    .where(eq(classMoveRequests.studentId, studentId))
    .orderBy(desc(classMoveRequests.createdAt))
    .limit(20);

  return rows.map((row) => ({
    id: row.id,
    studentId: row.studentId,
    requestedById: row.requestedById,
    requestedByName: `${row.requesterFirst} ${row.requesterLast}`.trim(),
    fromClassId: row.fromClassId,
    fromLabel: classDisplayName(row.fromSubjectName, row.fromClassName),
    fromSchedule: classScheduleLabel({
      weekday: row.fromWeekday,
      startTime: row.fromStartTime,
      endTime: row.fromEndTime,
    }),
    toClassId: row.toClassId,
    toLabel: classDisplayName(row.toSubjectName, row.toClassName),
    toSchedule: classScheduleLabel({
      weekday: row.toWeekday,
      startTime: row.toStartTime,
      endTime: row.toEndTime,
    }),
    reason: row.reason,
    status: row.status,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
  }));
}

/** Current enrolments plus valid same-subject destination classes. */
export async function getClassMoveData(
  studentId: string,
): Promise<ClassMoveData> {
  const tutor = alias(profiles, "move_class_tutor");
  const currentRows = await db
    .select({
      classId: classes.id,
      subjectId: classes.subjectId,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        isNull(enrollments.withdrawnAt),
      ),
    );

  const [requests, candidateRows] = await Promise.all([
    getClassMoveHistory(studentId),
    currentRows.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: classes.id,
            name: classes.name,
            subjectId: classes.subjectId,
            subjectName: subjects.name,
            tutorFirst: tutor.firstName,
            tutorLast: tutor.lastName,
            weekday: classes.weekday,
            startTime: classes.startTime,
            endTime: classes.endTime,
            location: classes.location,
            capacity: classes.capacity,
            enrolled: sql<number>`(
              select count(*)::int from ${enrollments}
              where ${enrollments.classId} = ${classes.id}
                and ${enrollments.withdrawnAt} is null
            )`,
          })
          .from(classes)
          .innerJoin(subjects, eq(subjects.id, classes.subjectId))
          .innerJoin(tutor, eq(tutor.id, classes.tutorId))
          .where(
            and(
              inArray(classes.subjectId, [
                ...new Set(currentRows.map((r) => r.subjectId)),
              ]),
              eq(classes.isRecurring, true),
            ),
          )
          .orderBy(asc(subjects.name), asc(classes.weekday), asc(classes.startTime)),
  ]);

  const currentIds = new Set(currentRows.map((row) => row.classId));
  const options: ClassMoveOption[] = candidateRows.map((row) => ({
    id: row.id,
    name: row.name,
    subjectId: row.subjectId,
    subjectName: row.subjectName,
    tutorName: `${row.tutorFirst} ${row.tutorLast}`.trim(),
    weekday: row.weekday,
    startTime: row.startTime,
    endTime: row.endTime,
    location: row.location,
    capacity: row.capacity,
    enrolled: Number(row.enrolled),
    isCurrent: currentIds.has(row.id),
    label: classDisplayName(row.subjectName, row.name),
    scheduleLabel: classScheduleLabel(row),
  }));

  return { classes: options, requests };
}
