import "server-only";
import { and, asc, desc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  attendance,
  classes,
  enrollments,
  homework,
  homeworkAssignments,
  lessons,
  profiles,
  terms,
} from "@/db/schema";
import type { ClassMetricRow } from "./reports-metrics";

export type TermOption = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

export async function listTerms(): Promise<TermOption[]> {
  const rows = await db
    .select({
      id: terms.id,
      year: terms.year,
      termNumber: terms.termNumber,
      startDate: terms.startDate,
      endDate: terms.endDate,
    })
    .from(terms)
    .orderBy(desc(terms.year), desc(terms.termNumber));
  return rows.map((t) => ({
    id: t.id,
    label: `${t.year} Term ${t.termNumber}`,
    startDate: t.startDate,
    endDate: t.endDate,
  }));
}

export async function getCurrentTermId(todayIso: string): Promise<string | null> {
  const rows = await db
    .select({ id: terms.id })
    .from(terms)
    .where(and(lte(terms.startDate, todayIso), gte(terms.endDate, todayIso)))
    .limit(1);
  return rows[0]?.id ?? null;
}

/** Exclusive upper bound: the day after `endDate`, so timestamp dueDates on the
 *  last day of term are included. */
function dayAfter(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function getClassMetricRows(term: {
  startDate: string;
  endDate: string;
}): Promise<ClassMetricRow[]> {
  const endExclusive = dayAfter(term.endDate);
  // homework.dueDate is a timestamptz column (mapped to Date by Drizzle), unlike
  // lessons.date which is a plain date column - so the term bounds must be
  // converted to Date objects here to satisfy the column's driver type.
  const termStartDate = new Date(`${term.startDate}T00:00:00Z`);
  const endExclusiveDate = new Date(`${endExclusive}T00:00:00Z`);

  const classRows = await db
    .select({
      classId: classes.id,
      className: classes.name,
      tutorFirst: profiles.firstName,
      tutorLast: profiles.lastName,
      capacity: classes.capacity,
    })
    .from(classes)
    .innerJoin(profiles, eq(profiles.id, classes.tutorId))
    .orderBy(asc(classes.name));

  const att = await db
    .select({
      classId: lessons.classId,
      attended: sql<number>`count(*) filter (where ${attendance.status} in ('present','late','left_early','makeup_attended'))`.mapWith(Number),
      marked: sql<number>`count(*)`.mapWith(Number),
    })
    .from(attendance)
    .innerJoin(lessons, eq(lessons.id, attendance.lessonId))
    .where(and(gte(lessons.date, term.startDate), lte(lessons.date, term.endDate)))
    .groupBy(lessons.classId);

  const hw = await db
    .select({
      classId: homework.classId,
      completed: sql<number>`count(*) filter (where ${homeworkAssignments.status} in ('submitted','late','marked','returned'))`.mapWith(Number),
      assigned: sql<number>`count(*)`.mapWith(Number),
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .where(and(gte(homework.dueDate, termStartDate), lt(homework.dueDate, endExclusiveDate)))
    .groupBy(homework.classId);

  const tst = await db
    .select({
      classId: homework.classId,
      scoreSum: sql<number>`coalesce(sum(${homeworkAssignments.score}), 0)`.mapWith(Number),
      scoreCount: sql<number>`count(${homeworkAssignments.score})`.mapWith(Number),
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .where(
      and(
        eq(homework.isTest, true),
        gte(homework.dueDate, termStartDate),
        lt(homework.dueDate, endExclusiveDate),
      ),
    )
    .groupBy(homework.classId);

  const enr = await db
    .select({
      classId: enrollments.classId,
      enrolled: sql<number>`count(*)`.mapWith(Number),
    })
    .from(enrollments)
    .where(isNull(enrollments.withdrawnAt))
    .groupBy(enrollments.classId);

  const attMap = new Map(att.map((r) => [r.classId, r]));
  const hwMap = new Map<string | null, (typeof hw)[number]>(hw.map((r) => [r.classId, r]));
  const tstMap = new Map<string | null, (typeof tst)[number]>(tst.map((r) => [r.classId, r]));
  const enrMap = new Map(enr.map((r) => [r.classId, r]));

  return classRows.map((c) => ({
    classId: c.classId,
    className: c.className,
    tutorName: `${c.tutorFirst} ${c.tutorLast}`.trim(),
    attended: attMap.get(c.classId)?.attended ?? 0,
    markedLessons: attMap.get(c.classId)?.marked ?? 0,
    homeworkCompleted: hwMap.get(c.classId)?.completed ?? 0,
    homeworkAssigned: hwMap.get(c.classId)?.assigned ?? 0,
    enrolled: enrMap.get(c.classId)?.enrolled ?? 0,
    capacity: c.capacity,
    testScoreSum: tstMap.get(c.classId)?.scoreSum ?? 0,
    testScoreCount: tstMap.get(c.classId)?.scoreCount ?? 0,
  }));
}
