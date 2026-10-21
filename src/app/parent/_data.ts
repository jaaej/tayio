import "server-only";
import { cookies } from "next/headers";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  announcements,
  announcementRecipients,
  attendance,
  classes,
  enrollments,
  familyLinks,
  homework,
  homeworkAssignments,
  invoices,
  lessons,
  profiles,
  subjects,
} from "@/db/schema";
import { getOfficeContact, type OfficeContact } from "@/lib/office-contact";
import { isInvoiceOpen } from "@/lib/invoice-rules";
import { isHandedIn } from "@/lib/homework-rules";
import { meanMastery, type TopicMastery } from "@/lib/topic-mastery";
import { getSubjectMastery } from "@/lib/topic-mastery-data";
import { getStudentProgressBySubject } from "@/app/student/_lib/queries";
import { attendanceSummary } from "@/lib/attendance-rules";
import { attendanceMovedSql, attendanceStatusShownSql } from "@/lib/attendance-moved";
import { SELECTED_CHILD_COOKIE, pickSelectedChild } from "@/lib/parent-child";

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

/**
 * The parent's children and the one to show: `?child=` if it is theirs,
 * else the child they chose last (`SELECTED_CHILD_COOKIE`), else the first.
 */
export async function resolveSelectedChild(
  parentId: string,
  requested: string | undefined,
): Promise<{ children: ParentChild[]; selected: ParentChild | null }> {
  const [children, jar] = await Promise.all([getParentChildren(parentId), cookies()]);
  const remembered = jar.get(SELECTED_CHILD_COOKIE)?.value;
  return { children, selected: pickSelectedChild(children, requested, remembered) };
}

export type DashboardData = {
  attendanceRate: number | null;
  attendanceCount: number;
  absenceCount: number;
  homeworkCompleted: number;
  homeworkTotal: number;
};

export async function getDashboardData(studentId: string): Promise<DashboardData> {
  const attendanceRows = await db
    .select({ status: attendance.status, moved: attendanceMovedSql })
    .from(attendance)
    .where(eq(attendance.studentId, studentId));
  // A moved or credited lesson is neither attended nor an absence.
  const summary = attendanceSummary(attendanceRows);
  const attendanceCount = summary.total;
  const absenceCount = summary.absent;
  const attendanceRate = summary.percent;

  const homeworkRows = await db
    .select({ status: homeworkAssignments.status })
    .from(homeworkAssignments)
    .where(eq(homeworkAssignments.studentId, studentId));
  const homeworkTotal = homeworkRows.length;
  // A late hand-in is handed in (homework-rules).
  const homeworkCompleted = homeworkRows.filter((r) => isHandedIn(r.status)).length;

  return {
    attendanceRate,
    attendanceCount,
    absenceCount,
    homeworkCompleted,
    homeworkTotal,
  };
}

export async function getOutstandingBalanceForParent(parentId: string): Promise<number> {
  const rows = await db
    .select({ amount: invoices.amount, status: invoices.status })
    .from(invoices)
    .where(eq(invoices.parentId, parentId));
  return rows
    .filter((r) => isInvoiceOpen(r.status))
    .reduce((sum, r) => sum + Number(r.amount), 0);
}

export type AttendanceRow = {
  lessonId: string;
  date: string;
  startTime: string;
  subjectName: string | null;
  tutorName: string;
  status: typeof attendance.status.enumValues[number];
  /** An absence written by a reschedule or a credit: reads "Moved". */
  moved: boolean;
};

/** The child's marked lessons, newest first; `subjectId` narrows to one subject. */
export async function getAttendance(
  studentId: string,
  opts: { subjectId?: string } = {},
): Promise<AttendanceRow[]> {
  const tutorProfile = profiles;
  const rows = await db
    .select({
      lessonId: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      subjectName: subjects.name,
      tutorFirst: tutorProfile.firstName,
      tutorLast: tutorProfile.lastName,
      status: attendanceStatusShownSql,
      moved: attendanceMovedSql,
    })
    .from(attendance)
    .innerJoin(lessons, eq(lessons.id, attendance.lessonId))
    .leftJoin(classes, eq(classes.id, lessons.classId))
    .leftJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(tutorProfile, eq(tutorProfile.id, lessons.tutorId))
    .where(
      and(
        eq(attendance.studentId, studentId),
        opts.subjectId ? eq(classes.subjectId, opts.subjectId) : undefined,
      ),
    )
    .orderBy(desc(lessons.date), desc(lessons.startTime));

  return rows.map((r) => ({
    lessonId: r.lessonId,
    date: r.date,
    startTime: r.startTime,
    subjectName: r.subjectName,
    tutorName: `${r.tutorFirst} ${r.tutorLast}`.trim(),
    status: r.status,
    moved: r.moved,
  }));
}

export type HomeworkRow = {
  homeworkId: string;
  title: string;
  subjectId: string | null;
  subjectName: string | null;
  subjectYearLevel: string | null;
  subjectColor: string | null;
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
      subjectId: subjects.id,
      subjectName: subjects.name,
      subjectYearLevel: subjects.yearLevel,
      subjectColor: subjects.color,
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

/**
 * Which subject a class belongs to, for one of the parent's children who is
 * (or was) in it: the requested child first. Null unless the class is a
 * linked child's, so it keeps the parent -> child -> class scope.
 */
export async function getParentClassSubject(
  parentId: string,
  classId: string,
  requestedChild: string | undefined,
): Promise<{ subjectId: string; childId: string } | null> {
  const rows = await db
    .select({ subjectId: classes.subjectId, childId: enrollments.studentId })
    .from(classes)
    .innerJoin(enrollments, eq(enrollments.classId, classes.id))
    .innerJoin(
      familyLinks,
      and(eq(familyLinks.studentId, enrollments.studentId), eq(familyLinks.parentId, parentId)),
    )
    .where(eq(classes.id, classId));
  return rows.find((r) => r.childId === requestedChild) ?? rows[0] ?? null;
}

export type ChildMastery = {
  /** Mean of the subjects with marks; null before anything is marked. */
  overall: number | null;
  subjects: Array<{
    subjectId: string;
    subjectName: string;
    subjectColor: string | null;
    percent: number | null;
    topics: TopicMastery[];
  }>;
};

/** A child's topic mastery from their marks, the loader students use too. */
export async function getChildMastery(studentId: string): Promise<ChildMastery> {
  const enrolled = await getStudentProgressBySubject(studentId);
  const mastery = await getSubjectMastery(studentId, enrolled.map((s) => s.subjectId));
  const subjects = enrolled.map((s) => ({
    subjectId: s.subjectId,
    subjectName: s.subjectName,
    subjectColor: s.subjectColor,
    percent: mastery.get(s.subjectId)?.percent ?? null,
    topics: mastery.get(s.subjectId)?.topics ?? [],
  }));
  return { overall: meanMastery(subjects), subjects };
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

export type AdminContact = OfficeContact;

/** The office a parent messages: the same active admin students are offered. */
export async function getAdminContact(): Promise<AdminContact | null> {
  return getOfficeContact();
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
  return db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      publishedAt: announcements.publishedAt,
    })
    .from(announcements)
    .innerJoin(
      announcementRecipients,
      eq(announcementRecipients.announcementId, announcements.id),
    )
    .where(
      and(
        eq(announcementRecipients.userId, parentId),
        eq(announcements.status, "published"),
      ),
    )
    .orderBy(desc(announcements.publishedAt))
    .limit(limit);
}
