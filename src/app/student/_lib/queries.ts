import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { studentOnClassRosterSql } from "@/lib/class-roster-sql";
import { isoDate } from "@/lib/format";
import { HANDED_IN_STATUSES } from "@/lib/homework-rules";
import { isInvoiceOpen } from "@/lib/invoice-rules";
import { familyNoteWrittenSql } from "@/lib/lesson-recap";
import {
  attendance,
  classCredits,
  classes,
  enrollments,
  homework,
  homeworkAssignments,
  invoices,
  lessonNotes,
  lessons,
  profiles,
  rescheduleRequests,
  subjects,
} from "@/db/schema";
import { getOfficeContact, type OfficeContact } from "@/lib/office-contact";

export type SubjectSummary = {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string | null;
  yearLevel: string | null;
  tutorFirstName: string;
  tutorLastName: string;
  nextLessonDate: string | null;
  dueHomeworkCount: number;
};

export async function getStudentSubjects(studentId: string): Promise<SubjectSummary[]> {
  // Base list - enrolled classes with subject + tutor
  const enrolled = await db
    .select({
      classId: classes.id,
      className: classes.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
      subjectColor: subjects.color,
      yearLevel: subjects.yearLevel,
      tutorFirstName: profiles.firstName,
      tutorLastName: profiles.lastName,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, classes.tutorId))
    .where(
      and(eq(enrollments.studentId, studentId), isNull(enrollments.withdrawnAt)),
    )
    .orderBy(asc(subjects.name));

  if (enrolled.length === 0) return [];

  const classIds = enrolled.map((e) => e.classId);
  const today = isoDate(new Date());

  // Next upcoming lesson per class
  const nextLessons = await db
    .select({
      classId: lessons.classId,
      date: sql<string>`min(${lessons.date})`,
    })
    .from(lessons)
    .where(
      and(
        inArray(lessons.classId, classIds),
        gte(lessons.date, today),
        eq(lessons.status, "upcoming"),
      ),
    )
    .groupBy(lessons.classId);
  const nextLessonByClass = new Map(nextLessons.map((r) => [r.classId, r.date]));

  // Due homework count per class
  const dueByClass = await db
    .select({
      classId: homework.classId,
      count: sql<number>`count(*)::int`,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .where(
      and(
        eq(homeworkAssignments.studentId, studentId),
        notInArray(homeworkAssignments.status, [...HANDED_IN_STATUSES]),
      ),
    )
    .groupBy(homework.classId);
  const dueByClassMap = new Map(
    dueByClass.filter((r) => r.classId).map((r) => [r.classId!, r.count]),
  );

  return enrolled.map((e) => ({
    ...e,
    nextLessonDate: nextLessonByClass.get(e.classId) ?? null,
    dueHomeworkCount: dueByClassMap.get(e.classId) ?? 0,
  }));
}

export type SubjectProgress = {
  subjectId: string;
  subjectName: string;
  subjectColor: string | null;
  yearLevel: string | null;
};

/** The subjects the student is enrolled in, once each, by name. */
export async function getStudentProgressBySubject(
  studentId: string,
): Promise<SubjectProgress[]> {
  const enrolledSubjects = await db
    .select({
      subjectId: subjects.id,
      subjectName: subjects.name,
      subjectColor: subjects.color,
      yearLevel: subjects.yearLevel,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(
      and(eq(enrollments.studentId, studentId), isNull(enrollments.withdrawnAt)),
    )
    .orderBy(asc(subjects.name));

  return [...new Map(enrolledSubjects.map((s) => [s.subjectId, s])).values()];
}

export type SubjectProgressDetail = {
  subjectId: string;
  subjectName: string;
  subjectColor: string | null;
  yearLevel: string | null;
  homework: Array<{
    homeworkId: string;
    title: string;
    dueDate: Date;
    status:
      | "not_started"
      | "viewed"
      | "submitted"
      | "late"
      | "marked"
      | "returned"
      | "resubmission_requested";
    score: string | null;
    feedback: string | null;
    submittedAt: Date | null;
    markedAt: Date | null;
    isTest: boolean;
    className: string | null;
  }>;
};

export async function getStudentProgressSubjectDetail(
  studentId: string,
  subjectId: string,
): Promise<SubjectProgressDetail | null> {
  // Verify the student is enrolled in at least one class for this subject.
  const enrolment = await db
    .select({ subjectId: classes.subjectId })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(classes.subjectId, subjectId),
        isNull(enrollments.withdrawnAt),
      ),
    )
    .limit(1);
  if (enrolment.length === 0) return null;

  const [subjectRow] = await db
    .select({
      id: subjects.id,
      name: subjects.name,
      color: subjects.color,
      yearLevel: subjects.yearLevel,
    })
    .from(subjects)
    .where(eq(subjects.id, subjectId))
    .limit(1);
  if (!subjectRow) return null;

  const homeworkRows = await db
    .select({
      homeworkId: homework.id,
      title: homework.title,
      dueDate: homework.dueDate,
      status: homeworkAssignments.status,
      score: homeworkAssignments.score,
      feedback: homeworkAssignments.feedback,
      submittedAt: homeworkAssignments.submittedAt,
      markedAt: homeworkAssignments.markedAt,
      isTest: homework.isTest,
      className: classes.name,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .innerJoin(classes, eq(classes.id, homework.classId))
    .where(
      and(
        eq(homeworkAssignments.studentId, studentId),
        eq(classes.subjectId, subjectId),
      ),
    )
    .orderBy(desc(homework.dueDate));

  return {
    subjectId: subjectRow.id,
    subjectName: subjectRow.name,
    subjectColor: subjectRow.color,
    yearLevel: subjectRow.yearLevel,
    homework: homeworkRows,
  };
}

/**
 * Rank for a specific test (homework with is_test = true), within the cohort
 * of students who have a score on that same test. Anonymous - returns only
 * { rank, total }, never names or scores. RANK() handles ties (1,2,2,4).
 * Returns null if the homework isn't a test, the student isn't marked yet,
 * or there are no marked students at all.
 */
export async function getStudentTestRank(
  studentId: string,
  homeworkId: string,
): Promise<{ rank: number; total: number } | null> {
  const rows = await db.execute<{ rnk: number; total: number }>(sql`
    with ranked as (
      select
        ${homeworkAssignments.studentId} as student_id,
        rank() over (order by ${homeworkAssignments.score} desc nulls last) as rnk,
        count(*) over () as total
      from ${homeworkAssignments}
      inner join ${homework} on ${homework.id} = ${homeworkAssignments.homeworkId}
      where ${homeworkAssignments.homeworkId} = ${homeworkId}
        and ${homework.isTest} = true
        and ${homeworkAssignments.score} is not null
    )
    select rnk, total
    from ranked
    where student_id = ${studentId}
    limit 1
  `);
  const row = rows[0];
  if (!row) return null;
  return { rank: Number(row.rnk), total: Number(row.total) };
}

/**
 * Overall rank within a subject - averages each student's marked test scores
 * (only is_test = true homework rows) and ranks by average descending.
 * Cohort = students with at least one marked test in this subject across any
 * class. With `term`, only tests due on the Melbourne days it covers count
 * (either bound may be open). Returns null if the student has no marked
 * tests in the subject yet.
 */
export async function getStudentOverallSubjectRank(
  studentId: string,
  subjectId: string,
  term?: { coversFrom: string | null; coversUntil: string | null },
): Promise<{ rank: number; total: number } | null> {
  const dueDay = sql`(${homework.dueDate} at time zone 'Australia/Melbourne')::date`;
  const inTerm = sql`${term?.coversFrom ? sql`and ${dueDay} >= ${term.coversFrom}::date` : sql``}
        ${term?.coversUntil ? sql`and ${dueDay} <= ${term.coversUntil}::date` : sql``}`;
  const rows = await db.execute<{ rnk: number; total: number }>(sql`
    with test_scores as (
      select
        ${homeworkAssignments.studentId} as student_id,
        avg(${homeworkAssignments.score}) as avg_score
      from ${homeworkAssignments}
      inner join ${homework} on ${homework.id} = ${homeworkAssignments.homeworkId}
      inner join ${classes} on ${classes.id} = ${homework.classId}
      where ${classes.subjectId} = ${subjectId}
        and ${homework.isTest} = true
        and ${homeworkAssignments.score} is not null
        ${inTerm}
      group by ${homeworkAssignments.studentId}
    ),
    ranked as (
      select
        student_id,
        rank() over (order by avg_score desc) as rnk,
        count(*) over () as total
      from test_scores
    )
    select rnk, total
    from ranked
    where student_id = ${studentId}
    limit 1
  `);
  const row = rows[0];
  if (!row) return null;
  return { rank: Number(row.rnk), total: Number(row.total) };
}

export async function getEnrolledClassIds(studentId: string) {
  const rows = await db
    .select({ classId: enrollments.classId })
    .from(enrollments)
    .where(
      and(eq(enrollments.studentId, studentId), isNull(enrollments.withdrawnAt)),
    );
  return rows.map((r) => r.classId);
}

export type HomeworkRow = {
  homeworkId: string;
  title: string;
  description: string | null;
  attachmentUrl: string | null;
  dueDate: Date;
  allowResubmission: boolean;
  status: (typeof homeworkAssignments.$inferSelect)["status"];
  submittedAt: Date | null;
  submissionUrl: string | null;
  submissionText: string | null;
  score: string | null;
  feedback: string | null;
  markedAt: Date | null;
  className: string | null;
  subjectName: string | null;
  subjectColor: string | null;
};

export async function getStudentHomework(studentId: string): Promise<HomeworkRow[]> {
  return db
    .select({
      homeworkId: homework.id,
      title: homework.title,
      description: homework.description,
      attachmentUrl: homework.attachmentUrl,
      dueDate: homework.dueDate,
      allowResubmission: homework.allowResubmission,
      status: homeworkAssignments.status,
      submittedAt: homeworkAssignments.submittedAt,
      submissionUrl: homeworkAssignments.submissionUrl,
      submissionText: homeworkAssignments.submissionText,
      score: homeworkAssignments.score,
      feedback: homeworkAssignments.feedback,
      markedAt: homeworkAssignments.markedAt,
      className: classes.name,
      subjectName: subjects.name,
      subjectColor: subjects.color,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .leftJoin(classes, eq(classes.id, homework.classId))
    .leftJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(eq(homeworkAssignments.studentId, studentId))
    .orderBy(asc(homework.dueDate));
}

export async function getHomeworkDetail(studentId: string, homeworkId: string) {
  const rows = await db
    .select({
      homeworkId: homework.id,
      title: homework.title,
      description: homework.description,
      attachmentUrl: homework.attachmentUrl,
      solutionUrl: homework.solutionUrl,
      dueDate: homework.dueDate,
      allowResubmission: homework.allowResubmission,
      isTest: homework.isTest,
      status: homeworkAssignments.status,
      submittedAt: homeworkAssignments.submittedAt,
      submissionUrl: homeworkAssignments.submissionUrl,
      submissionText: homeworkAssignments.submissionText,
      score: homeworkAssignments.score,
      feedback: homeworkAssignments.feedback,
      className: classes.name,
      subjectName: subjects.name,
      subjectColor: subjects.color,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .leftJoin(classes, eq(classes.id, homework.classId))
    .leftJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(
      and(
        eq(homeworkAssignments.studentId, studentId),
        eq(homeworkAssignments.homeworkId, homeworkId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getDueHomeworkCount(studentId: string) {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(homeworkAssignments)
    .where(
      and(
        eq(homeworkAssignments.studentId, studentId),
        notInArray(homeworkAssignments.status, [...HANDED_IN_STATUSES]),
      ),
    );
  return rows[0]?.count ?? 0;
}

export type LessonWithNoteListItem = {
  lessonId: string;
  date: string;
  startTime: string;
  status: (typeof lessons.$inferSelect)["status"];
  className: string;
  subjectName: string;
  subjectColor: string | null;
  /** The tutor wrote something for the family (`hasFamilyNote`). */
  hasNote: boolean;
  recordingUrl: string | null;
};

/**
 * The student's most recent lessons (newest first) with whether a recap
 * exists. `until` (YYYY-MM-DD, inclusive) drops lessons after that day, so a
 * list of past lessons never shows ones that have not happened yet.
 */
export async function getStudentLessonsWithNotes(
  studentId: string,
  opts: { until?: string } = {},
): Promise<LessonWithNoteListItem[]> {
  const rows = await db
    .select({
      lessonId: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      status: lessons.status,
      className: classes.name,
      subjectName: subjects.name,
      subjectColor: subjects.color,
      recordingUrl: lessons.recordingUrl,
      hasNote: sql<boolean>`coalesce(${familyNoteWrittenSql}, false)`,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .leftJoin(
      lessonNotes,
      and(
        eq(lessonNotes.lessonId, lessons.id),
        eq(lessonNotes.studentId, studentId),
      ),
    )
    .where(
      and(
        // Their class's lessons they were on the roll for, and lessons they
        // attended as a make-up; never a classmate's private make-up.
        or(
          studentOnClassRosterSql(studentId),
          sql`exists (select 1 from attendance a where a.lesson_id = ${lessons.id} and a.student_id = ${studentId} and a.status = 'makeup_attended')`,
        ),
        opts.until ? lte(lessons.date, opts.until) : undefined,
      ),
    )
    .orderBy(desc(lessons.date), desc(lessons.startTime))
    .limit(30);

  return rows;
}

// --- Attendance-aware timetable (reschedule spec 2026-07-10) ---
// Unlike getStudentLessons (pure enrolment), this overlays the student's own
// attendance so a reschedule is visible: a lesson they moved away from is
// "moved_out", and a make-up lesson they now attend (even in a class they're
// not enrolled in) shows as "makeup_in".

export type TimetableLesson = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: (typeof lessons.status.enumValues)[number];
  subjectId: string;
  subjectName: string;
  subjectYearLevel: string | null;
  subjectColor: string | null;
  className: string;
  location: string | null;
  /** The lesson's tutor, "First Last"; null on a synthetic pending chip. */
  tutorName: string | null;
  studentState:
    | "normal"
    | "moved_out"
    | "makeup_in"
    | "pending_out"
    | "pending_in";
  moveLabel: string | null;
};

export async function getStudentTimetableLessons(
  studentId: string,
  opts: { from?: Date; to?: Date } = {},
): Promise<TimetableLesson[]> {
  const fromIso = opts.from ? isoDate(opts.from) : undefined;
  const toIso = opts.to ? isoDate(opts.to) : undefined;
  const range = () => {
    const c = [];
    if (fromIso) c.push(gte(lessons.date, fromIso));
    if (toIso) c.push(lt(lessons.date, toIso));
    return c;
  };
  const baseCols = {
    id: lessons.id,
    date: lessons.date,
    startTime: lessons.startTime,
    endTime: lessons.endTime,
    status: lessons.status,
    subjectId: classes.subjectId,
    subjectName: subjects.name,
    subjectYearLevel: subjects.yearLevel,
    subjectColor: subjects.color,
    className: classes.name,
    location: sql<string | null>`coalesce(nullif(trim(${lessons.location}), ''), nullif(trim(${classes.location}), ''))`,
    tutorName: sql<string | null>`nullif(trim(concat_ws(' ', ${profiles.firstName}, ${profiles.lastName})), '')`,
  };

  // The lessons of their classes they are on the roll for (joined by then,
  // not left, not taken off that one lesson). Their own make-ups follow.
  const enrolledLessons = await db
    .select(baseCols)
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .leftJoin(profiles, eq(profiles.id, lessons.tutorId))
    .where(and(studentOnClassRosterSql(studentId), ...range()));

  const attRows = await db
    .select({ lessonId: attendance.lessonId, status: attendance.status })
    .from(attendance)
    .innerJoin(lessons, eq(lessons.id, attendance.lessonId))
    .where(and(eq(attendance.studentId, studentId), ...range()));
  const attByLesson = new Map(attRows.map((a) => [a.lessonId, a.status]));

  const enrolledIds = new Set(enrolledLessons.map((l) => l.id));
  const makeupIds = attRows
    .filter((a) => a.status === "makeup_attended" && !enrolledIds.has(a.lessonId))
    .map((a) => a.lessonId);
  const makeupLessons = makeupIds.length
    ? await db
        .select(baseCols)
        .from(lessons)
        .innerJoin(classes, eq(classes.id, lessons.classId))
        .innerJoin(subjects, eq(subjects.id, classes.subjectId))
        .leftJoin(profiles, eq(profiles.id, lessons.tutorId))
        .where(inArray(lessons.id, makeupIds))
    : [];

  const resched = await db
    .select({
      originalLessonId: rescheduleRequests.originalLessonId,
      targetLessonId: rescheduleRequests.targetLessonId,
      targetDate: rescheduleRequests.targetDate,
    })
    .from(rescheduleRequests)
    .where(
      and(
        eq(rescheduleRequests.studentId, studentId),
        eq(rescheduleRequests.status, "approved"),
      ),
    );
  const movedOut = new Map<string, { lessonId: string | null; date: string | null }>();
  const movedInOrigin = new Map<string, string>();
  for (const r of resched) {
    movedOut.set(r.originalLessonId, { lessonId: r.targetLessonId, date: r.targetDate });
    if (r.targetLessonId) movedInOrigin.set(r.targetLessonId, r.originalLessonId);
  }

  const refIds = new Set<string>();
  for (const v of movedOut.values()) if (v.lessonId) refIds.add(v.lessonId);
  for (const o of movedInOrigin.values()) refIds.add(o);
  const refInfo = new Map<string, { className: string }>();
  if (refIds.size) {
    const rows = await db
      .select({ id: lessons.id, className: classes.name })
      .from(lessons)
      .innerJoin(classes, eq(classes.id, lessons.classId))
      .where(inArray(lessons.id, Array.from(refIds)));
    for (const r of rows) refInfo.set(r.id, { className: r.className });
  }

  // Make-up lessons booked by redeeming a class credit are tagged distinctly
  // from reschedule make-ups.
  const creditMakeupRows = await db
    .select({ lessonId: classCredits.redeemedOnLessonId })
    .from(classCredits)
    .where(
      and(eq(classCredits.studentId, studentId), isNotNull(classCredits.redeemedOnLessonId)),
    );
  const creditMakeupIds = new Set(
    creditMakeupRows.map((r) => r.lessonId).filter((id): id is string => !!id),
  );

  const seen = new Set<string>();
  const out: TimetableLesson[] = [];
  for (const l of [...enrolledLessons, ...makeupLessons]) {
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    const status = attByLesson.get(l.id);
    let studentState: TimetableLesson["studentState"] = "normal";
    let moveLabel: string | null = null;
    if (status === "makeup_attended") {
      studentState = "makeup_in";
      if (creditMakeupIds.has(l.id)) {
        moveLabel = "Make-up: booked with credits";
      } else {
        const originId = movedInOrigin.get(l.id);
        const info = originId ? refInfo.get(originId) : undefined;
        moveLabel = info ? `Make-up: from ${info.className}` : "Make-up";
      }
    } else if (status === "absent" && movedOut.has(l.id)) {
      studentState = "moved_out";
      const tgt = movedOut.get(l.id)!;
      const info = tgt.lessonId ? refInfo.get(tgt.lessonId) : undefined;
      moveLabel = info
        ? `Moved → ${info.className}`
        : tgt.date
          ? `Moved → ${tgt.date}`
          : "Moved";
    }
    out.push({ ...l, studentState, moveLabel });
  }

  // Pending requests: tag the original "Move pending" and add a synthetic
  // "Waiting for approval" chip at the requested slot.
  const pendings = await db
    .select({
      id: rescheduleRequests.id,
      originalLessonId: rescheduleRequests.originalLessonId,
      targetDate: rescheduleRequests.targetDate,
      targetStartTime: rescheduleRequests.targetStartTime,
      targetEndTime: rescheduleRequests.targetEndTime,
    })
    .from(rescheduleRequests)
    .where(
      and(
        eq(rescheduleRequests.studentId, studentId),
        eq(rescheduleRequests.status, "pending"),
      ),
    );
  const byId = new Map(out.map((l) => [l.id, l]));
  for (const pr of pendings) {
    const orig = byId.get(pr.originalLessonId);
    if (orig && orig.studentState === "normal") {
      orig.studentState = "pending_out";
      orig.moveLabel = "Move pending";
    }
    if (
      pr.targetDate &&
      pr.targetStartTime &&
      (!fromIso || pr.targetDate >= fromIso) &&
      (!toIso || pr.targetDate < toIso)
    ) {
      out.push({
        id: `pending-${pr.id}`,
        date: pr.targetDate,
        startTime: pr.targetStartTime,
        endTime: pr.targetEndTime ?? pr.targetStartTime,
        status: "upcoming",
        subjectId: orig?.subjectId ?? "",
        subjectName: orig?.subjectName ?? "Lesson",
        subjectYearLevel: orig?.subjectYearLevel ?? null,
        subjectColor: orig?.subjectColor ?? null,
        className: orig?.className ?? "",
        location: orig?.location ?? null,
        tutorName: null,
        studentState: "pending_in",
        moveLabel: "Waiting for approval",
      });
    }
  }

  out.sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
  );
  return out;
}

// --- Unrestricted-student features (role-tiers spec 2026-07-09) ---
// These read the student's OWN invoices (invoices.studentId = self). Gated at
// the page/action layer by requireUnrestrictedStudent(); restricted students
// never reach them.

export type StudentInvoiceRow = {
  id: string;
  amount: string;
  currency: string;
  status: (typeof invoices.status.enumValues)[number];
  issuedAt: Date;
  dueDate: string;
  paidAt: Date | null;
  description: string | null;
};

export async function getInvoicesForStudent(
  studentId: string,
): Promise<StudentInvoiceRow[]> {
  return db
    .select({
      id: invoices.id,
      amount: invoices.amount,
      currency: invoices.currency,
      status: invoices.status,
      issuedAt: invoices.issuedAt,
      dueDate: invoices.dueDate,
      paidAt: invoices.paidAt,
      description: invoices.description,
    })
    .from(invoices)
    .where(eq(invoices.studentId, studentId))
    .orderBy(desc(invoices.issuedAt));
}

export async function getOutstandingBalanceForStudent(
  studentId: string,
): Promise<number> {
  const rows = await db
    .select({ amount: invoices.amount, status: invoices.status })
    .from(invoices)
    .where(eq(invoices.studentId, studentId));
  return rows
    .filter((r) => isInvoiceOpen(r.status))
    .reduce((sum, r) => sum + Number(r.amount), 0);
}

export type StudentAdminContact = OfficeContact | null;

/** The office the student can DM (the same admin the parent portal offers). */
export async function getAdminContactForStudent(): Promise<StudentAdminContact> {
  return getOfficeContact();
}

export type StudentTutorContact = {
  id: string;
  firstName: string;
  lastName: string;
  subjects: string[];
  /** Ids of those subjects: names can repeat, so match on these. */
  subjectIds: string[];
};

/** Tutors teaching the student's active classes, with the subjects they teach them. */
export async function getStudentTutors(
  studentId: string,
): Promise<StudentTutorContact[]> {
  const rows = await db
    .select({
      tutorId: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      subjectId: subjects.id,
      subjectName: subjects.name,
      subjectColor: subjects.color,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(profiles, eq(profiles.id, classes.tutorId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        isNull(enrollments.withdrawnAt),
        eq(profiles.isActive, true),
      ),
    );

  const byTutor = new Map<string, StudentTutorContact>();
  for (const r of rows) {
    const cur = byTutor.get(r.tutorId) ?? {
      id: r.tutorId,
      firstName: r.firstName,
      lastName: r.lastName,
      subjects: [],
      subjectIds: [],
    };
    if (!cur.subjectIds.includes(r.subjectId)) {
      cur.subjectIds.push(r.subjectId);
      cur.subjects.push(r.subjectName);
    }
    byTutor.set(r.tutorId, cur);
  }
  return Array.from(byTutor.values()).sort((a, b) =>
    a.firstName.localeCompare(b.firstName),
  );
}
