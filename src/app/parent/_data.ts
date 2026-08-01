import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  announcements,
  attendance,
  classes,
  enrollments,
  familyLinks,
  homework,
  homeworkAssignments,
  invoices,
  lessonNotes,
  lessons,
  profiles,
  progressTopics,
  subjects,
} from "@/db/schema";
import { ADMIN_TIERS } from "@/lib/roles";

export type ParentChild = {
  id: string;
  firstName: string;
  lastName: string;
  yearLevel: string | null;
  relationship: string;
};

export async function getParentChildren(parentId: string): Promise<ParentChild[]> {
  const rows = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      yearLevel: profiles.yearLevel,
      relationship: familyLinks.relationship,
    })
    .from(familyLinks)
    .innerJoin(profiles, eq(profiles.id, familyLinks.studentId))
    .where(eq(familyLinks.parentId, parentId))
    .orderBy(profiles.firstName);
  return rows;
}

export async function resolveSelectedChild(
  parentId: string,
  requested: string | undefined,
): Promise<{ children: ParentChild[]; selected: ParentChild | null }> {
  const children = await getParentChildren(parentId);
  if (children.length === 0) return { children, selected: null };
  const match = requested
    ? children.find((c) => c.id === requested) ?? children[0]
    : children[0];
  return { children, selected: match };
}

export type DashboardData = {
  attendanceRate: number | null;
  attendanceCount: number;
  absenceCount: number;
  homeworkCompleted: number;
  homeworkTotal: number;
  nextLesson: {
    date: string;
    startTime: string;
    subjectName: string;
    tutorName: string;
  } | null;
  latestFeedback: {
    createdAt: Date;
    parentVisibleComment: string;
    subjectName: string | null;
    tutorName: string;
  } | null;
};

const MASTERY_PERCENT = {
  not_started: 0,
  needs_work: 30,
  improving: 65,
  strong: 92,
} as const;

export async function getDashboardData(studentId: string): Promise<DashboardData> {
  const attendanceRows = await db
    .select({ status: attendance.status })
    .from(attendance)
    .where(eq(attendance.studentId, studentId));
  const attendanceCount = attendanceRows.length;
  const presentLike = attendanceRows.filter(
    (r) => r.status === "present" || r.status === "late" || r.status === "makeup_attended",
  ).length;
  const absenceCount = attendanceRows.filter((r) => r.status === "absent").length;
  const attendanceRate =
    attendanceCount > 0 ? Math.round((presentLike / attendanceCount) * 100) : null;

  const homeworkRows = await db
    .select({ status: homeworkAssignments.status })
    .from(homeworkAssignments)
    .where(eq(homeworkAssignments.studentId, studentId));
  const homeworkTotal = homeworkRows.length;
  const homeworkCompleted = homeworkRows.filter(
    (r) => r.status === "submitted" || r.status === "marked" || r.status === "returned",
  ).length;

  const tutorProfile = profiles;
  const today = new Date().toISOString().slice(0, 10);
  const nextLessonRows = await db
    .select({
      date: lessons.date,
      startTime: lessons.startTime,
      subjectName: subjects.name,
      tutorFirst: tutorProfile.firstName,
      tutorLast: tutorProfile.lastName,
    })
    .from(enrollments)
    .innerJoin(lessons, eq(lessons.classId, enrollments.classId))
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(tutorProfile, eq(tutorProfile.id, lessons.tutorId))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        isNull(enrollments.withdrawnAt),
        gte(lessons.date, today),
        or(eq(lessons.status, "upcoming"), eq(lessons.status, "rescheduled")),
      ),
    )
    .orderBy(lessons.date, lessons.startTime)
    .limit(1);

  const nextLesson = nextLessonRows[0]
    ? {
        date: nextLessonRows[0].date,
        startTime: nextLessonRows[0].startTime,
        subjectName: nextLessonRows[0].subjectName,
        tutorName: `${nextLessonRows[0].tutorFirst} ${nextLessonRows[0].tutorLast}`.trim(),
      }
    : null;

  const noteRows = await db
    .select({
      createdAt: lessonNotes.createdAt,
      parentVisibleComment: lessonNotes.parentVisibleComment,
      subjectName: subjects.name,
      tutorFirst: tutorProfile.firstName,
      tutorLast: tutorProfile.lastName,
    })
    .from(lessonNotes)
    .innerJoin(lessons, eq(lessons.id, lessonNotes.lessonId))
    .leftJoin(classes, eq(classes.id, lessons.classId))
    .leftJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(tutorProfile, eq(tutorProfile.id, lessonNotes.tutorId))
    .where(
      and(
        eq(lessonNotes.studentId, studentId),
        sql`${lessonNotes.parentVisibleComment} IS NOT NULL AND length(${lessonNotes.parentVisibleComment}) > 0`,
      ),
    )
    .orderBy(desc(lessonNotes.createdAt))
    .limit(1);

  const latestFeedback = noteRows[0]
    ? {
        createdAt: noteRows[0].createdAt,
        parentVisibleComment: noteRows[0].parentVisibleComment!,
        subjectName: noteRows[0].subjectName,
        tutorName: `${noteRows[0].tutorFirst} ${noteRows[0].tutorLast}`.trim(),
      }
    : null;

  return {
    attendanceRate,
    attendanceCount,
    absenceCount,
    homeworkCompleted,
    homeworkTotal,
    nextLesson,
    latestFeedback,
  };
}

export async function getOutstandingBalanceForParent(parentId: string): Promise<number> {
  const rows = await db
    .select({ amount: invoices.amount, status: invoices.status })
    .from(invoices)
    .where(eq(invoices.parentId, parentId));
  return rows
    .filter((r) => r.status === "unpaid" || r.status === "overdue" || r.status === "partially_paid")
    .reduce((sum, r) => sum + Number(r.amount), 0);
}

export type AttendanceRow = {
  lessonId: string;
  date: string;
  startTime: string;
  subjectName: string | null;
  tutorName: string;
  status: typeof attendance.status.enumValues[number];
  note: string | null;
};

export async function getAttendance(studentId: string): Promise<AttendanceRow[]> {
  const tutorProfile = profiles;
  const rows = await db
    .select({
      lessonId: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      subjectName: subjects.name,
      tutorFirst: tutorProfile.firstName,
      tutorLast: tutorProfile.lastName,
      status: attendance.status,
      note: attendance.note,
    })
    .from(attendance)
    .innerJoin(lessons, eq(lessons.id, attendance.lessonId))
    .leftJoin(classes, eq(classes.id, lessons.classId))
    .leftJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(tutorProfile, eq(tutorProfile.id, lessons.tutorId))
    .where(eq(attendance.studentId, studentId))
    .orderBy(desc(lessons.date), desc(lessons.startTime));

  return rows.map((r) => ({
    lessonId: r.lessonId,
    date: r.date,
    startTime: r.startTime,
    subjectName: r.subjectName,
    tutorName: `${r.tutorFirst} ${r.tutorLast}`.trim(),
    status: r.status,
    note: r.note,
  }));
}

export type HomeworkRow = {
  homeworkId: string;
  title: string;
  subjectName: string | null;
  className: string | null;
  dueDate: Date;
  status: typeof homeworkAssignments.status.enumValues[number];
  score: string | null;
  feedback: string | null;
  submittedAt: Date | null;
};

export async function getHomework(studentId: string): Promise<HomeworkRow[]> {
  const rows = await db
    .select({
      homeworkId: homework.id,
      title: homework.title,
      subjectName: subjects.name,
      className: classes.name,
      dueDate: homework.dueDate,
      status: homeworkAssignments.status,
      score: homeworkAssignments.score,
      feedback: homeworkAssignments.feedback,
      submittedAt: homeworkAssignments.submittedAt,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .leftJoin(classes, eq(classes.id, homework.classId))
    .leftJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(eq(homeworkAssignments.studentId, studentId))
    .orderBy(desc(homework.dueDate));

  return rows;
}

export type FeedbackRow = {
  id: string;
  createdAt: Date;
  lessonDate: string;
  subjectName: string | null;
  tutorName: string;
  topicCovered: string | null;
  parentVisibleComment: string;
};

export async function getFeedback(studentId: string): Promise<FeedbackRow[]> {
  const tutorProfile = profiles;
  const rows = await db
    .select({
      id: lessonNotes.id,
      createdAt: lessonNotes.createdAt,
      lessonDate: lessons.date,
      subjectName: subjects.name,
      tutorFirst: tutorProfile.firstName,
      tutorLast: tutorProfile.lastName,
      topicCovered: lessonNotes.topicCovered,
      parentVisibleComment: lessonNotes.parentVisibleComment,
    })
    .from(lessonNotes)
    .innerJoin(lessons, eq(lessons.id, lessonNotes.lessonId))
    .leftJoin(classes, eq(classes.id, lessons.classId))
    .leftJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(tutorProfile, eq(tutorProfile.id, lessonNotes.tutorId))
    .where(
      and(
        eq(lessonNotes.studentId, studentId),
        sql`${lessonNotes.parentVisibleComment} IS NOT NULL AND length(${lessonNotes.parentVisibleComment}) > 0`,
      ),
    )
    .orderBy(desc(lessonNotes.createdAt));

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    lessonDate: r.lessonDate,
    subjectName: r.subjectName,
    tutorName: `${r.tutorFirst} ${r.tutorLast}`.trim(),
    topicCovered: r.topicCovered,
    parentVisibleComment: r.parentVisibleComment!,
  }));
}

export type WeekLessonRow = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  subjectName: string;
};

export async function getLessonsBetween(
  studentId: string,
  fromIso: string,
  toIso: string,
): Promise<WeekLessonRow[]> {
  const rows = await db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      subjectName: subjects.name,
    })
    .from(enrollments)
    .innerJoin(lessons, eq(lessons.classId, enrollments.classId))
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        isNull(enrollments.withdrawnAt),
        gte(lessons.date, fromIso),
        lt(lessons.date, toIso),
      ),
    )
    .orderBy(asc(lessons.date), asc(lessons.startTime));
  return rows;
}

export type MonthLessonRow = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  subjectName: string;
  className: string;
  tutorName: string;
  status: typeof lessons.status.enumValues[number];
  location: string | null;
};

export async function getMonthLessons(
  studentId: string,
  fromIso: string,
  toIso: string,
): Promise<MonthLessonRow[]> {
  const tutorProfile = profiles;
  const rows = await db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      subjectName: subjects.name,
      className: classes.name,
      tutorFirst: tutorProfile.firstName,
      tutorLast: tutorProfile.lastName,
      status: lessons.status,
      location: lessons.location,
    })
    .from(enrollments)
    .innerJoin(lessons, eq(lessons.classId, enrollments.classId))
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(tutorProfile, eq(tutorProfile.id, lessons.tutorId))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        isNull(enrollments.withdrawnAt),
        gte(lessons.date, fromIso),
        lt(lessons.date, toIso),
      ),
    )
    .orderBy(asc(lessons.date), asc(lessons.startTime));
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    startTime: r.startTime,
    endTime: r.endTime,
    subjectName: r.subjectName,
    className: r.className,
    tutorName: `${r.tutorFirst} ${r.tutorLast}`.trim(),
    status: r.status,
    location: r.location,
  }));
}

export type UpcomingLesson = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  subjectName: string;
  tutorName: string;
};

export async function getUpcomingLessonsForChild(
  studentId: string,
  limit: number = 12,
): Promise<UpcomingLesson[]> {
  const tutorProfile = profiles;
  const todayIso = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  })();

  const rows = await db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      subjectName: subjects.name,
      tutorFirst: tutorProfile.firstName,
      tutorLast: tutorProfile.lastName,
    })
    .from(enrollments)
    .innerJoin(lessons, eq(lessons.classId, enrollments.classId))
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(tutorProfile, eq(tutorProfile.id, lessons.tutorId))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        isNull(enrollments.withdrawnAt),
        gte(lessons.date, todayIso),
        eq(lessons.status, "upcoming"),
      ),
    )
    .orderBy(asc(lessons.date), asc(lessons.startTime))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    startTime: r.startTime,
    endTime: r.endTime,
    subjectName: r.subjectName,
    tutorName: `${r.tutorFirst} ${r.tutorLast}`.trim(),
  }));
}

export async function getClassIdForLesson(lessonId: string): Promise<string | null> {
  const [row] = await db
    .select({ classId: lessons.classId })
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  return row?.classId ?? null;
}

export type RescheduleLessonDetail = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  subjectName: string;
  tutorName: string;
  childFirstName: string;
  childId: string;
  status: typeof lessons.status.enumValues[number];
};

/**
 * Fetches a lesson IF the requesting parent has at least one linked child
 * enrolled in the class. Returns null otherwise - caller must treat null as
 * "no access" or "not found" (do not leak the difference).
 */
export async function getRescheduleLessonForParent(
  parentId: string,
  lessonId: string,
): Promise<RescheduleLessonDetail | null> {
  const tutorProfile = alias(profiles, "tutor_profile");
  const childProfile = alias(profiles, "child_profile");
  const rows = await db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      subjectName: subjects.name,
      tutorFirst: tutorProfile.firstName,
      tutorLast: tutorProfile.lastName,
      childFirstName: childProfile.firstName,
      childId: childProfile.id,
      status: lessons.status,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(tutorProfile, eq(tutorProfile.id, lessons.tutorId))
    .innerJoin(enrollments, eq(enrollments.classId, lessons.classId))
    .innerJoin(childProfile, eq(childProfile.id, enrollments.studentId))
    .innerJoin(
      familyLinks,
      and(
        eq(familyLinks.studentId, enrollments.studentId),
        eq(familyLinks.parentId, parentId),
      ),
    )
    .where(and(eq(lessons.id, lessonId), isNull(enrollments.withdrawnAt)))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    date: r.date,
    startTime: r.startTime,
    endTime: r.endTime,
    subjectName: r.subjectName,
    tutorName: `${r.tutorFirst} ${r.tutorLast}`.trim(),
    childFirstName: r.childFirstName,
    childId: r.childId,
    status: r.status,
  };
}

export type DueHomeworkRow = {
  homeworkId: string;
  title: string;
  dueDate: Date;
  className: string | null;
  status: typeof homeworkAssignments.status.enumValues[number];
};

export async function getHomeworkDueBetween(
  studentId: string,
  from: Date,
  to: Date,
): Promise<DueHomeworkRow[]> {
  const rows = await db
    .select({
      homeworkId: homework.id,
      title: homework.title,
      dueDate: homework.dueDate,
      className: classes.name,
      status: homeworkAssignments.status,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .leftJoin(classes, eq(classes.id, homework.classId))
    .where(
      and(
        eq(homeworkAssignments.studentId, studentId),
        gte(homework.dueDate, from),
        lt(homework.dueDate, to),
      ),
    );
  return rows;
}

export type SubjectMastery = {
  subjectId: string;
  subjectName: string;
  percent: number;
  topicCount: number;
};

export async function getTopicMastery(studentId: string): Promise<SubjectMastery[]> {
  const rows = await db
    .select({
      subjectId: progressTopics.subjectId,
      subjectName: subjects.name,
      mastery: progressTopics.mastery,
    })
    .from(progressTopics)
    .innerJoin(subjects, eq(subjects.id, progressTopics.subjectId))
    .where(eq(progressTopics.studentId, studentId));

  const bySubject = new Map<string, { subjectName: string; sum: number; count: number }>();
  for (const r of rows) {
    const cur = bySubject.get(r.subjectId) ?? {
      subjectName: r.subjectName,
      sum: 0,
      count: 0,
    };
    cur.sum += MASTERY_PERCENT[r.mastery];
    cur.count += 1;
    bySubject.set(r.subjectId, cur);
  }
  return Array.from(bySubject, ([subjectId, v]) => ({
    subjectId,
    subjectName: v.subjectName,
    percent: v.count > 0 ? Math.round(v.sum / v.count) : 0,
    topicCount: v.count,
  })).sort((a, b) => a.subjectName.localeCompare(b.subjectName));
}

export type MasteryLevel = "not_started" | "needs_work" | "improving" | "strong";

export type ChildSubjectProgress = {
  subjectId: string;
  subjectName: string;
  yearLevel: string | null;
  masteryPercent: number;
  topics: Array<{ topic: string; mastery: MasteryLevel }>;
};

export async function getChildProgressBySubject(
  studentId: string,
): Promise<ChildSubjectProgress[]> {
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

  const topicsBySubject = new Map<string, Array<{ topic: string; mastery: MasteryLevel }>>();
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

export type InvoiceRow = {
  id: string;
  amount: string;
  currency: string;
  status: typeof invoices.status.enumValues[number];
  issuedAt: Date;
  dueDate: string;
  paidAt: Date | null;
  description: string | null;
  studentFirstName: string | null;
  studentLastName: string | null;
};

export async function getInvoicesForParent(parentId: string): Promise<InvoiceRow[]> {
  const studentProfile = profiles;
  const rows = await db
    .select({
      id: invoices.id,
      amount: invoices.amount,
      currency: invoices.currency,
      status: invoices.status,
      issuedAt: invoices.issuedAt,
      dueDate: invoices.dueDate,
      paidAt: invoices.paidAt,
      description: invoices.description,
      studentFirstName: studentProfile.firstName,
      studentLastName: studentProfile.lastName,
    })
    .from(invoices)
    .leftJoin(studentProfile, eq(studentProfile.id, invoices.studentId))
    .where(eq(invoices.parentId, parentId))
    .orderBy(desc(invoices.issuedAt));
  return rows;
}

export type ChildTutor = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  subjects: string[];
};

export async function getChildTutors(studentId: string): Promise<ChildTutor[]> {
  const rows = await db
    .select({
      tutorId: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      phone: profiles.phone,
      subjectName: subjects.name,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(profiles, eq(profiles.id, classes.tutorId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(
      and(eq(enrollments.studentId, studentId), isNull(enrollments.withdrawnAt)),
    );

  const byTutor = new Map<string, ChildTutor>();
  for (const r of rows) {
    const cur = byTutor.get(r.tutorId) ?? {
      id: r.tutorId,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      phone: r.phone,
      subjects: [],
    };
    if (!cur.subjects.includes(r.subjectName)) cur.subjects.push(r.subjectName);
    byTutor.set(r.tutorId, cur);
  }
  return Array.from(byTutor.values()).sort((a, b) =>
    a.firstName.localeCompare(b.firstName),
  );
}

export type AdminContact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
};

export async function getAdminContact(): Promise<AdminContact | null> {
  const rows = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      phone: profiles.phone,
    })
    .from(profiles)
    .where(inArray(profiles.role, ADMIN_TIERS))
    .orderBy(asc(profiles.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export type ParentDmContacts = {
  tutors: { id: string; name: string; meta: string }[];
  admin: { id: string; name: string } | null;
};

/** Contacts a parent can DM: distinct tutors across all their children, + admin. */
export async function getParentDmContacts(
  parentId: string,
): Promise<ParentDmContacts> {
  const kids = await db
    .select({ studentId: familyLinks.studentId })
    .from(familyLinks)
    .where(eq(familyLinks.parentId, parentId));

  const byTutor = new Map<
    string,
    { id: string; name: string; subjects: Set<string> }
  >();
  for (const k of kids) {
    const ts = await getChildTutors(k.studentId);
    for (const t of ts) {
      const cur = byTutor.get(t.id) ?? {
        id: t.id,
        name: `${t.firstName} ${t.lastName}`.trim(),
        subjects: new Set<string>(),
      };
      t.subjects.forEach((s) => cur.subjects.add(s));
      byTutor.set(t.id, cur);
    }
  }
  const tutors = Array.from(byTutor.values())
    .map((t) => ({
      id: t.id,
      name: t.name,
      meta: Array.from(t.subjects).join(" · "),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const adminRow = await getAdminContact();
  const admin = adminRow
    ? { id: adminRow.id, name: `${adminRow.firstName} ${adminRow.lastName}`.trim() }
    : null;

  return { tutors, admin };
}

export type ParentAnnouncement = {
  id: string;
  title: string;
  body: string;
  publishedAt: Date;
};

export async function getParentAnnouncements(
  parentId: string,
  limit = 4,
): Promise<ParentAnnouncement[]> {
  const childRows = await db
    .select({ studentId: familyLinks.studentId })
    .from(familyLinks)
    .where(eq(familyLinks.parentId, parentId));
  const childIds = childRows.map((r) => r.studentId);

  let classIds: string[] = [];
  if (childIds.length > 0) {
    const enrolled = await db
      .select({ classId: enrollments.classId })
      .from(enrollments)
      .where(
        and(inArray(enrollments.studentId, childIds), isNull(enrollments.withdrawnAt)),
      );
    classIds = Array.from(new Set(enrolled.map((r) => r.classId)));
  }

  const conditions = [
    isNull(announcements.audienceRole),
    eq(announcements.audienceRole, "parent"),
  ];
  if (classIds.length > 0) {
    conditions.push(inArray(announcements.audienceClassId, classIds));
  }

  return db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      publishedAt: announcements.publishedAt,
    })
    .from(announcements)
    .where(or(...conditions))
    .orderBy(desc(announcements.publishedAt))
    .limit(limit);
}
