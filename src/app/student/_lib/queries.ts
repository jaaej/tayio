import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  announcements,
  attendance,
  classes,
  enrollments,
  homework,
  homeworkAssignments,
  invoices,
  lessonNotes,
  lessons,
  profiles,
  progressTopics,
  rescheduleRequests,
  subjects,
  type UserRole,
} from "@/db/schema";
import { ADMIN_TIERS } from "@/lib/roles";

export type RecentFeedback = {
  lessonId: string;
  date: string;
  comment: string;
  subjectName: string;
  tutorFirstName: string;
  tutorLastName: string;
};

export async function getRecentFeedback(
  studentId: string,
  limit = 3,
): Promise<RecentFeedback[]> {
  return db
    .select({
      lessonId: lessons.id,
      date: lessons.date,
      comment: lessonNotes.parentVisibleComment,
      subjectName: subjects.name,
      tutorFirstName: profiles.firstName,
      tutorLastName: profiles.lastName,
    })
    .from(lessonNotes)
    .innerJoin(lessons, eq(lessons.id, lessonNotes.lessonId))
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, lessonNotes.tutorId))
    .where(
      and(
        eq(lessonNotes.studentId, studentId),
        isNotNull(lessonNotes.parentVisibleComment),
      ),
    )
    .orderBy(desc(lessons.date))
    .limit(limit)
    .then((rows) =>
      rows
        .filter((r) => r.comment !== null)
        .map((r) => ({ ...r, comment: r.comment as string })),
    );
}

export type RecentGrade = {
  homeworkId: string;
  title: string;
  score: string;
  feedback: string | null;
  markedAt: Date;
  className: string | null;
};

export async function getRecentGrades(
  studentId: string,
  limit = 5,
): Promise<RecentGrade[]> {
  return db
    .select({
      homeworkId: homework.id,
      title: homework.title,
      score: homeworkAssignments.score,
      feedback: homeworkAssignments.feedback,
      markedAt: homeworkAssignments.markedAt,
      className: classes.name,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .leftJoin(classes, eq(classes.id, homework.classId))
    .where(
      and(
        eq(homeworkAssignments.studentId, studentId),
        eq(homeworkAssignments.status, "marked"),
        isNotNull(homeworkAssignments.score),
        isNotNull(homeworkAssignments.markedAt),
      ),
    )
    .orderBy(desc(homeworkAssignments.markedAt))
    .limit(limit)
    .then((rows) =>
      rows
        .filter((r) => r.markedAt !== null && r.score !== null)
        .map((r) => ({
          ...r,
          score: r.score as string,
          markedAt: r.markedAt as Date,
        })),
    );
}

export type StudentAnnouncement = {
  id: string;
  title: string;
  body: string;
  publishedAt: Date;
  audienceRole: UserRole | null;
};

export async function getRelevantAnnouncements(
  studentId: string,
  limit = 4,
): Promise<StudentAnnouncement[]> {
  const enrolledClassIds = await getEnrolledClassIds(studentId);
  return db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      publishedAt: announcements.publishedAt,
      audienceRole: announcements.audienceRole,
    })
    .from(announcements)
    .where(
      or(
        isNull(announcements.audienceRole),
        eq(announcements.audienceRole, "student"),
        enrolledClassIds.length > 0
          ? inArray(announcements.audienceClassId, enrolledClassIds)
          : undefined,
      ),
    )
    .orderBy(desc(announcements.publishedAt))
    .limit(limit);
}

export type SubjectSummary = {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  yearLevel: string | null;
  tutorFirstName: string;
  tutorLastName: string;
  nextLessonDate: string | null;
  dueHomeworkCount: number;
  masteryPercent: number; // 0..100
};

const MASTERY_PERCENT = {
  not_started: 0,
  needs_work: 30,
  improving: 65,
  strong: 92,
} as const;

export async function getStudentSubjects(studentId: string): Promise<SubjectSummary[]> {
  // Base list — enrolled classes with subject + tutor
  const enrolled = await db
    .select({
      classId: classes.id,
      className: classes.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
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
  const subjectIds = enrolled.map((e) => e.subjectId);
  const today = new Date().toISOString().slice(0, 10);

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
        or(
          eq(homeworkAssignments.status, "not_started"),
          eq(homeworkAssignments.status, "viewed"),
          eq(homeworkAssignments.status, "resubmission_requested"),
        )!,
      ),
    )
    .groupBy(homework.classId);
  const dueByClassMap = new Map(
    dueByClass.filter((r) => r.classId).map((r) => [r.classId!, r.count]),
  );

  // Mastery percent per subject (averaged across topics)
  const mastery = await db
    .select({
      subjectId: progressTopics.subjectId,
      mastery: progressTopics.mastery,
    })
    .from(progressTopics)
    .where(
      and(
        eq(progressTopics.studentId, studentId),
        inArray(progressTopics.subjectId, subjectIds),
      ),
    );
  const masteryBySubject = new Map<string, { sum: number; count: number }>();
  for (const row of mastery) {
    const cur = masteryBySubject.get(row.subjectId) ?? { sum: 0, count: 0 };
    cur.sum += MASTERY_PERCENT[row.mastery];
    cur.count += 1;
    masteryBySubject.set(row.subjectId, cur);
  }

  return enrolled.map((e) => {
    const m = masteryBySubject.get(e.subjectId);
    return {
      ...e,
      nextLessonDate: nextLessonByClass.get(e.classId) ?? null,
      dueHomeworkCount: dueByClassMap.get(e.classId) ?? 0,
      masteryPercent: m && m.count > 0 ? Math.round(m.sum / m.count) : 0,
    };
  });
}

export type SubjectDetail = {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  yearLevel: string | null;
  tutorFirstName: string;
  tutorLastName: string;
  location: string | null;
  onlineLink: string | null;
  weekday: number | null;
  startTime: string | null;
  endTime: string | null;
  masteryPercent: number;
  topics: Array<{
    topic: string;
    mastery: "not_started" | "needs_work" | "improving" | "strong";
  }>;
  lessons: Array<{
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: (typeof lessons.$inferSelect)["status"];
    hasNote: boolean;
  }>;
  homework: Array<{
    homeworkId: string;
    title: string;
    dueDate: Date;
    status: (typeof homeworkAssignments.$inferSelect)["status"];
    score: string | null;
  }>;
};

export async function getSubjectDetail(
  studentId: string,
  classId: string,
): Promise<SubjectDetail | null> {
  // Verify enrolment
  const enrolledClassIds = await getEnrolledClassIds(studentId);
  if (!enrolledClassIds.includes(classId)) return null;

  const [row] = await db
    .select({
      classId: classes.id,
      className: classes.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
      yearLevel: subjects.yearLevel,
      tutorFirstName: profiles.firstName,
      tutorLastName: profiles.lastName,
      location: classes.location,
      onlineLink: classes.onlineLink,
      weekday: classes.weekday,
      startTime: classes.startTime,
      endTime: classes.endTime,
    })
    .from(classes)
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, classes.tutorId))
    .where(eq(classes.id, classId))
    .limit(1);
  if (!row) return null;

  const topics = await db
    .select({
      topic: progressTopics.topic,
      mastery: progressTopics.mastery,
    })
    .from(progressTopics)
    .where(
      and(
        eq(progressTopics.studentId, studentId),
        eq(progressTopics.subjectId, row.subjectId),
      ),
    )
    .orderBy(asc(progressTopics.topic));

  const masterySum = topics.reduce(
    (acc, t) => acc + MASTERY_PERCENT[t.mastery],
    0,
  );
  const masteryPercent =
    topics.length > 0 ? Math.round(masterySum / topics.length) : 0;

  const lessonRows = await db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      status: lessons.status,
      noteId: lessonNotes.id,
    })
    .from(lessons)
    .leftJoin(
      lessonNotes,
      and(
        eq(lessonNotes.lessonId, lessons.id),
        eq(lessonNotes.studentId, studentId),
      ),
    )
    .where(eq(lessons.classId, classId))
    .orderBy(desc(lessons.date), desc(lessons.startTime))
    .limit(20);

  const homeworkRows = await db
    .select({
      homeworkId: homework.id,
      title: homework.title,
      dueDate: homework.dueDate,
      status: homeworkAssignments.status,
      score: homeworkAssignments.score,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .where(
      and(
        eq(homeworkAssignments.studentId, studentId),
        eq(homework.classId, classId),
      ),
    )
    .orderBy(desc(homework.dueDate))
    .limit(20);

  return {
    ...row,
    masteryPercent,
    topics,
    lessons: lessonRows.map(({ noteId, ...l }) => ({
      ...l,
      hasNote: noteId !== null,
    })),
    homework: homeworkRows,
  };
}

export type SubjectProgress = {
  subjectId: string;
  subjectName: string;
  yearLevel: string | null;
  masteryPercent: number;
  topics: Array<{
    topic: string;
    mastery: "not_started" | "needs_work" | "improving" | "strong";
  }>;
};

export async function getStudentProgressBySubject(
  studentId: string,
): Promise<SubjectProgress[]> {
  const enrolledSubjects = await db
    .select({
      subjectId: subjects.id,
      subjectName: subjects.name,
      yearLevel: subjects.yearLevel,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(
      and(eq(enrollments.studentId, studentId), isNull(enrollments.withdrawnAt)),
    )
    .orderBy(asc(subjects.name));

  const seen = new Set<string>();
  const uniqueSubjects = enrolledSubjects.filter((s) => {
    if (seen.has(s.subjectId)) return false;
    seen.add(s.subjectId);
    return true;
  });

  if (uniqueSubjects.length === 0) return [];

  const subjectIds = uniqueSubjects.map((s) => s.subjectId);

  const allTopics = await db
    .select({
      subjectId: progressTopics.subjectId,
      topic: progressTopics.topic,
      mastery: progressTopics.mastery,
    })
    .from(progressTopics)
    .where(
      and(
        eq(progressTopics.studentId, studentId),
        inArray(progressTopics.subjectId, subjectIds),
      ),
    )
    .orderBy(asc(progressTopics.topic));

  const topicsBySubject = new Map<
    string,
    Array<{
      topic: string;
      mastery: "not_started" | "needs_work" | "improving" | "strong";
    }>
  >();
  for (const row of allTopics) {
    const arr = topicsBySubject.get(row.subjectId) ?? [];
    arr.push({ topic: row.topic, mastery: row.mastery });
    topicsBySubject.set(row.subjectId, arr);
  }

  return uniqueSubjects.map((s) => {
    const topics = topicsBySubject.get(s.subjectId) ?? [];
    const sum = topics.reduce((acc, t) => acc + MASTERY_PERCENT[t.mastery], 0);
    const masteryPercent =
      topics.length > 0 ? Math.round(sum / topics.length) : 0;
    return { ...s, masteryPercent, topics };
  });
}

export type SubjectProgressDetail = {
  subjectId: string;
  subjectName: string;
  yearLevel: string | null;
  masteryPercent: number;
  topics: Array<{
    topic: string;
    mastery: "not_started" | "needs_work" | "improving" | "strong";
  }>;
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
      yearLevel: subjects.yearLevel,
    })
    .from(subjects)
    .where(eq(subjects.id, subjectId))
    .limit(1);
  if (!subjectRow) return null;

  const topics = await db
    .select({
      topic: progressTopics.topic,
      mastery: progressTopics.mastery,
    })
    .from(progressTopics)
    .where(
      and(
        eq(progressTopics.studentId, studentId),
        eq(progressTopics.subjectId, subjectId),
      ),
    )
    .orderBy(asc(progressTopics.topic));

  const sum = topics.reduce(
    (acc, t) => acc + MASTERY_PERCENT[t.mastery],
    0,
  );
  const masteryPercent =
    topics.length > 0 ? Math.round(sum / topics.length) : 0;

  const homeworkRows = await db
    .select({
      homeworkId: homework.id,
      title: homework.title,
      dueDate: homework.dueDate,
      status: homeworkAssignments.status,
      score: homeworkAssignments.score,
      feedback: homeworkAssignments.feedback,
      submittedAt: homeworkAssignments.submittedAt,
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
    yearLevel: subjectRow.yearLevel,
    masteryPercent,
    topics,
    homework: homeworkRows,
  };
}

/**
 * Rank for a specific test (homework with is_test = true), within the cohort
 * of students who have a score on that same test. Anonymous — returns only
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
 * Overall rank within a subject — averages each student's marked test scores
 * (only is_test = true homework rows) and ranks by average descending.
 * Cohort = students with at least one marked test in this subject across any
 * class. Returns null if the student has no marked tests in the subject yet.
 */
export async function getStudentOverallSubjectRank(
  studentId: string,
  subjectId: string,
): Promise<{ rank: number; total: number } | null> {
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

export type LessonRow = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: (typeof lessons.$inferSelect)["status"];
  location: string | null;
  onlineLink: string | null;
  className: string;
  subjectName: string;
  tutorFirstName: string;
  tutorLastName: string;
};

export async function getStudentLessons(
  studentId: string,
  opts: { from?: Date; to?: Date; limit?: number } = {},
): Promise<LessonRow[]> {
  const enrolledClassIds = await getEnrolledClassIds(studentId);
  if (enrolledClassIds.length === 0) return [];

  const conditions = [inArray(lessons.classId, enrolledClassIds)];
  if (opts.from) {
    conditions.push(gte(lessons.date, opts.from.toISOString().slice(0, 10)));
  }
  if (opts.to) {
    conditions.push(lt(lessons.date, opts.to.toISOString().slice(0, 10)));
  }

  const query = db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      status: lessons.status,
      location: lessons.location,
      onlineLink: lessons.onlineLink,
      className: classes.name,
      subjectName: subjects.name,
      tutorFirstName: profiles.firstName,
      tutorLastName: profiles.lastName,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, lessons.tutorId))
    .where(and(...conditions))
    .orderBy(asc(lessons.date), asc(lessons.startTime));

  const rows = opts.limit ? await query.limit(opts.limit) : await query;
  return rows;
}

export async function getNextLesson(studentId: string): Promise<LessonRow | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows = await getStudentLessons(studentId, { from: today, limit: 1 });
  return rows[0] ?? null;
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
  className: string | null;
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
      className: classes.name,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .leftJoin(classes, eq(classes.id, homework.classId))
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
        or(
          eq(homeworkAssignments.status, "not_started"),
          eq(homeworkAssignments.status, "viewed"),
          eq(homeworkAssignments.status, "resubmission_requested"),
        )!,
      ),
    );
  return rows[0]?.count ?? 0;
}

export async function getNextDueHomework(studentId: string): Promise<HomeworkRow | null> {
  const rows = await db
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
      className: classes.name,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .leftJoin(classes, eq(classes.id, homework.classId))
    .where(
      and(
        eq(homeworkAssignments.studentId, studentId),
        or(
          eq(homeworkAssignments.status, "not_started"),
          eq(homeworkAssignments.status, "viewed"),
          eq(homeworkAssignments.status, "resubmission_requested"),
        )!,
      ),
    )
    .orderBy(asc(homework.dueDate))
    .limit(1);
  return rows[0] ?? null;
}

export type LessonRecap = {
  lessonId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: (typeof lessons.$inferSelect)["status"];
  className: string;
  subjectName: string;
  tutorFirstName: string;
  tutorLastName: string;
  topicCovered: string | null;
  keyConcepts: string | null;
  performance: string | null;
  strengths: string | null;
  struggles: string | null;
  nextLessonFocus: string | null;
  parentVisibleComment: string | null;
  // internalNote intentionally excluded — never expose to students.
};

export async function getLessonRecap(
  studentId: string,
  lessonId: string,
): Promise<LessonRecap | null> {
  const enrolledClassIds = await getEnrolledClassIds(studentId);
  if (enrolledClassIds.length === 0) return null;

  const rows = await db
    .select({
      lessonId: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      status: lessons.status,
      className: classes.name,
      subjectName: subjects.name,
      tutorFirstName: profiles.firstName,
      tutorLastName: profiles.lastName,
      topicCovered: lessonNotes.topicCovered,
      keyConcepts: lessonNotes.keyConcepts,
      performance: lessonNotes.performance,
      strengths: lessonNotes.strengths,
      struggles: lessonNotes.struggles,
      nextLessonFocus: lessonNotes.nextLessonFocus,
      parentVisibleComment: lessonNotes.parentVisibleComment,
      classId: lessons.classId,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, lessons.tutorId))
    .leftJoin(
      lessonNotes,
      and(
        eq(lessonNotes.lessonId, lessons.id),
        eq(lessonNotes.studentId, studentId),
      ),
    )
    .where(eq(lessons.id, lessonId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (!enrolledClassIds.includes(row.classId)) return null;
  const { classId: _classId, ...recap } = row;
  return recap;
}

export type LessonWithNoteListItem = {
  lessonId: string;
  date: string;
  startTime: string;
  status: (typeof lessons.$inferSelect)["status"];
  className: string;
  subjectName: string;
  hasNote: boolean;
};

export async function getStudentLessonsWithNotes(
  studentId: string,
): Promise<LessonWithNoteListItem[]> {
  const enrolledClassIds = await getEnrolledClassIds(studentId);
  if (enrolledClassIds.length === 0) return [];

  const rows = await db
    .select({
      lessonId: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      status: lessons.status,
      className: classes.name,
      subjectName: subjects.name,
      noteId: lessonNotes.id,
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
    .where(inArray(lessons.classId, enrolledClassIds))
    .orderBy(desc(lessons.date), desc(lessons.startTime))
    .limit(30);

  return rows.map(({ noteId, ...r }) => ({ ...r, hasNote: noteId !== null }));
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
  className: string;
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
  const enrolledClassIds = await getEnrolledClassIds(studentId);
  const fromIso = opts.from ? opts.from.toISOString().slice(0, 10) : undefined;
  const toIso = opts.to ? opts.to.toISOString().slice(0, 10) : undefined;
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
    className: classes.name,
  };

  const enrolledLessons = enrolledClassIds.length
    ? await db
        .select(baseCols)
        .from(lessons)
        .innerJoin(classes, eq(classes.id, lessons.classId))
        .innerJoin(subjects, eq(subjects.id, classes.subjectId))
        .where(and(inArray(lessons.classId, enrolledClassIds), ...range()))
    : [];

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
      const originId = movedInOrigin.get(l.id);
      const info = originId ? refInfo.get(originId) : undefined;
      moveLabel = info ? `Make-up · from ${info.className}` : "Make-up";
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
        className: orig?.className ?? "",
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
    .filter(
      (r) =>
        r.status === "unpaid" ||
        r.status === "overdue" ||
        r.status === "partially_paid",
    )
    .reduce((sum, r) => sum + Number(r.amount), 0);
}

export type StudentAdminContact = {
  id: string;
  firstName: string;
  lastName: string;
} | null;

/** One active admin the student can DM (unrestricted students only). */
export async function getAdminContactForStudent(): Promise<StudentAdminContact> {
  const rows = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(profiles)
    .where(and(inArray(profiles.role, ADMIN_TIERS), eq(profiles.isActive, true)))
    .orderBy(asc(profiles.firstName))
    .limit(1);
  return rows[0] ?? null;
}
