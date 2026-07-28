import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { STUDENT_TIERS } from "@/lib/roles";
import {
  announcements,
  classes,
  enrollments,
  homeworkAssignments,
  invoices,
  lessonNotes,
  lessons,
  profiles,
  subjects,
  type UserRole,
} from "@/db/schema";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export type OpsStats = {
  activeStudents: number;
  activeTutors: number;
  lessonsThisWeek: number;
  lessonsCompletedThisWeek: number;
  overdueCount: number;
  overdueTotal: number;
  notesPending: number;
  revenueMonth: number;
  revenueLastMonth: number;
};

export async function getOpsStats(opts: {
  weekStart: Date;
  weekEnd: Date;
  monthStart: Date;
  prevMonthStart: Date;
  today: Date;
}): Promise<OpsStats> {
  const { weekStart, weekEnd, monthStart, prevMonthStart, today } = opts;
  const todayIso = isoDate(today);

  const [students] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(profiles)
    .where(and(inArray(profiles.role, STUDENT_TIERS), eq(profiles.isActive, true)));

  const [tutors] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(profiles)
    .where(and(eq(profiles.role, "tutor"), eq(profiles.isActive, true)));

  const [weekLessons] = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${lessons.status} = 'completed')::int`,
    })
    .from(lessons)
    .where(
      and(
        gte(lessons.date, isoDate(weekStart)),
        lt(lessons.date, isoDate(weekEnd)),
      ),
    );

  const [overdue] = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${invoices.amount}), 0)::text`,
    })
    .from(invoices)
    .where(
      and(
        sql`${invoices.status} in ('unpaid','overdue','partially_paid')`,
        lt(invoices.dueDate, todayIso),
      ),
    );

  const [notes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(lessons)
    .leftJoin(lessonNotes, eq(lessonNotes.lessonId, lessons.id))
    .where(
      and(
        eq(lessons.status, "completed"),
        lt(lessons.date, todayIso),
        isNull(lessonNotes.id),
      ),
    );

  const [revMonth] = await db
    .select({
      total: sql<string>`coalesce(sum(${invoices.amount}), 0)::text`,
    })
    .from(invoices)
    .where(and(eq(invoices.status, "paid"), gte(invoices.issuedAt, monthStart)));

  const [revPrev] = await db
    .select({
      total: sql<string>`coalesce(sum(${invoices.amount}), 0)::text`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        gte(invoices.issuedAt, prevMonthStart),
        lt(invoices.issuedAt, monthStart),
      ),
    );

  return {
    activeStudents: students?.count ?? 0,
    activeTutors: tutors?.count ?? 0,
    lessonsThisWeek: weekLessons?.total ?? 0,
    lessonsCompletedThisWeek: weekLessons?.completed ?? 0,
    overdueCount: overdue?.count ?? 0,
    overdueTotal: Number(overdue?.total ?? 0),
    notesPending: notes?.count ?? 0,
    revenueMonth: Number(revMonth?.total ?? 0),
    revenueLastMonth: Number(revPrev?.total ?? 0),
  };
}

export type RevenueSummary = {
  revenueMonth: number;
  revenueLastMonth: number;
  overdueTotal: number;
  overdueCount: number;
};

/** Financial figures for the PIN-gated revenue page. */
export async function getRevenueSummary(now: Date): Promise<RevenueSummary> {
  // Bucket by paidAt (cash received in the month), not issuedAt — a "Revenue"
  // figure means money collected. Both months are half-open [start, nextStart).
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const todayIso = isoDate(now);

  const [revMonth] = await db
    .select({ total: sql<string>`coalesce(sum(${invoices.amount}), 0)::text` })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        gte(invoices.paidAt, monthStart),
        lt(invoices.paidAt, nextMonthStart),
      ),
    );

  const [revPrev] = await db
    .select({ total: sql<string>`coalesce(sum(${invoices.amount}), 0)::text` })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        gte(invoices.paidAt, prevMonthStart),
        lt(invoices.paidAt, monthStart),
      ),
    );

  const [overdue] = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${invoices.amount}), 0)::text`,
    })
    .from(invoices)
    .where(
      and(
        sql`${invoices.status} in ('unpaid','overdue','partially_paid')`,
        lt(invoices.dueDate, todayIso),
      ),
    );

  return {
    revenueMonth: Number(revMonth?.total ?? 0),
    revenueLastMonth: Number(revPrev?.total ?? 0),
    overdueTotal: Number(overdue?.total ?? 0),
    overdueCount: overdue?.count ?? 0,
  };
}

export type RecentPayment = {
  id: string;
  at: Date | null;
  amount: string;
  currency: string;
  parentFirst: string;
  parentLast: string;
};

/** Most recent paid invoices, for the revenue page. */
export async function getRecentPayments(limit = 8): Promise<RecentPayment[]> {
  const parent = alias(profiles, "parent");
  return db
    .select({
      id: invoices.id,
      at: invoices.paidAt,
      amount: invoices.amount,
      currency: invoices.currency,
      parentFirst: parent.firstName,
      parentLast: parent.lastName,
    })
    .from(invoices)
    .innerJoin(parent, eq(parent.id, invoices.parentId))
    .where(and(eq(invoices.status, "paid"), sql`${invoices.paidAt} is not null`))
    .orderBy(desc(invoices.paidAt))
    .limit(limit);
}

export type TutorBacklog = {
  tutorId: string;
  firstName: string;
  lastName: string;
  pendingNotes: number;
};

export async function getTutorsWithPendingNotes(
  windowStart: Date,
  windowEnd: Date,
  limit = 5,
): Promise<TutorBacklog[]> {
  const rows = await db
    .select({
      tutorId: lessons.tutorId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      pendingNotes: sql<number>`count(*)::int`,
    })
    .from(lessons)
    .innerJoin(profiles, eq(profiles.id, lessons.tutorId))
    .leftJoin(lessonNotes, eq(lessonNotes.lessonId, lessons.id))
    .where(
      and(
        eq(lessons.status, "completed"),
        gte(lessons.date, isoDate(windowStart)),
        lt(lessons.date, isoDate(windowEnd)),
        isNull(lessonNotes.id),
      ),
    )
    .groupBy(lessons.tutorId, profiles.firstName, profiles.lastName)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
  return rows;
}

export type OverdueInvoice = {
  id: string;
  amount: string;
  currency: string;
  dueDate: string;
  parentFirst: string;
  parentLast: string;
  studentFirst: string | null;
  studentLast: string | null;
};

export async function getOverdueInvoices(
  today: Date,
  limit = 6,
): Promise<OverdueInvoice[]> {
  const parent = alias(profiles, "parent");
  const student = alias(profiles, "student");
  return db
    .select({
      id: invoices.id,
      amount: invoices.amount,
      currency: invoices.currency,
      dueDate: invoices.dueDate,
      parentFirst: parent.firstName,
      parentLast: parent.lastName,
      studentFirst: student.firstName,
      studentLast: student.lastName,
    })
    .from(invoices)
    .innerJoin(parent, eq(parent.id, invoices.parentId))
    .leftJoin(student, eq(student.id, invoices.studentId))
    .where(
      and(
        sql`${invoices.status} in ('unpaid','overdue','partially_paid')`,
        lt(invoices.dueDate, isoDate(today)),
      ),
    )
    .orderBy(asc(invoices.dueDate))
    .limit(limit);
}

export type AtRiskStudent = {
  studentId: string;
  firstName: string;
  lastName: string;
  yearLevel: string | null;
  pendingHomework: number;
  completionPercent: number;
};

export async function getAtRiskStudents(limit = 5): Promise<AtRiskStudent[]> {
  // Students with the most pending / late homework, with overall completion %.
  const rows = await db
    .select({
      studentId: homeworkAssignments.studentId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      yearLevel: profiles.yearLevel,
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${homeworkAssignments.status} in ('not_started','viewed','late','resubmission_requested'))::int`,
      complete: sql<number>`count(*) filter (where ${homeworkAssignments.status} in ('submitted','marked','returned'))::int`,
    })
    .from(homeworkAssignments)
    .innerJoin(profiles, eq(profiles.id, homeworkAssignments.studentId))
    .where(eq(profiles.isActive, true))
    .groupBy(
      homeworkAssignments.studentId,
      profiles.firstName,
      profiles.lastName,
      profiles.yearLevel,
    )
    .having(
      sql`count(*) filter (where ${homeworkAssignments.status} in ('not_started','viewed','late','resubmission_requested')) > 0`,
    )
    .orderBy(
      desc(
        sql`count(*) filter (where ${homeworkAssignments.status} in ('not_started','viewed','late','resubmission_requested'))`,
      ),
    )
    .limit(limit);

  return rows.map((r) => ({
    studentId: r.studentId,
    firstName: r.firstName,
    lastName: r.lastName,
    yearLevel: r.yearLevel,
    pendingHomework: r.pending,
    completionPercent:
      r.total > 0 ? Math.round((r.complete / r.total) * 100) : 0,
  }));
}

export type ActivityEvent = {
  kind: "enrolment" | "payment" | "announcement";
  at: Date;
  title: string;
  meta: string | null;
  href: string;
};

export async function getRecentActivity(limit = 8): Promise<ActivityEvent[]> {
  const student = alias(profiles, "student");
  const enrolRows = await db
    .select({
      at: enrollments.enrolledAt,
      studentFirst: student.firstName,
      studentLast: student.lastName,
      className: classes.name,
    })
    .from(enrollments)
    .innerJoin(student, eq(student.id, enrollments.studentId))
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .orderBy(desc(enrollments.enrolledAt))
    .limit(limit);

  const parent = alias(profiles, "parent");
  const paymentRows = await db
    .select({
      id: invoices.id,
      at: invoices.paidAt,
      amount: invoices.amount,
      currency: invoices.currency,
      parentFirst: parent.firstName,
      parentLast: parent.lastName,
    })
    .from(invoices)
    .innerJoin(parent, eq(parent.id, invoices.parentId))
    .where(and(eq(invoices.status, "paid"), sql`${invoices.paidAt} is not null`))
    .orderBy(desc(invoices.paidAt))
    .limit(limit);

  const annRows = await db
    .select({
      id: announcements.id,
      at: announcements.publishedAt,
      title: announcements.title,
      audienceRole: announcements.audienceRole,
      className: classes.name,
    })
    .from(announcements)
    .leftJoin(classes, eq(classes.id, announcements.audienceClassId))
    .orderBy(desc(announcements.publishedAt))
    .limit(limit);

  const events: ActivityEvent[] = [];
  for (const r of enrolRows) {
    events.push({
      kind: "enrolment",
      at: r.at,
      title: `${r.studentFirst} ${r.studentLast} enrolled`,
      meta: r.className,
      href: "/admin/enrolments",
    });
  }
  for (const r of paymentRows) {
    if (!r.at) continue;
    const amount = new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: r.currency,
      maximumFractionDigits: 0,
    }).format(Number(r.amount));
    events.push({
      kind: "payment",
      at: r.at,
      title: `${r.parentFirst} ${r.parentLast} paid`,
      meta: amount,
      href: "/admin/payments",
    });
  }
  for (const r of annRows) {
    const audience = r.className
      ? `Class · ${r.className}`
      : r.audienceRole
        ? `All ${r.audienceRole}s`
        : "Everyone";
    events.push({
      kind: "announcement",
      at: r.at,
      title: r.title,
      meta: audience,
      href: "/admin/announcements",
    });
  }

  return events
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);
}

export type WeekLesson = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: (typeof lessons.$inferSelect)["status"];
  className: string;
  subjectName: string;
  tutorFirst: string;
  tutorLast: string;
};

export async function getWeekLessons(
  weekStart: Date,
  weekEnd: Date,
): Promise<WeekLesson[]> {
  return db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      status: lessons.status,
      className: classes.name,
      subjectName: subjects.name,
      tutorFirst: profiles.firstName,
      tutorLast: profiles.lastName,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, lessons.tutorId))
    .where(
      and(
        gte(lessons.date, isoDate(weekStart)),
        lt(lessons.date, isoDate(weekEnd)),
      ),
    )
    .orderBy(asc(lessons.date), asc(lessons.startTime));
}

export type RecentAnnouncement = {
  id: string;
  title: string;
  body: string;
  publishedAt: Date;
  audienceRole: UserRole | null;
  className: string | null;
};

export async function getRecentAnnouncements(
  limit = 4,
): Promise<RecentAnnouncement[]> {
  return db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      publishedAt: announcements.publishedAt,
      audienceRole: announcements.audienceRole,
      className: classes.name,
    })
    .from(announcements)
    .leftJoin(classes, eq(classes.id, announcements.audienceClassId))
    .orderBy(desc(announcements.publishedAt))
    .limit(limit);
}

export type StudentLesson = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: (typeof lessons.$inferSelect)["status"];
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  tutorId: string;
  tutorFirstName: string;
  tutorLastName: string;
  /** rescheduledFrom uuid (null on normal lessons). Surfaced for context. */
  rescheduledFrom: string | null;
};

/**
 * Upcoming lessons for a student (from today, within `days` ahead), only
 * for classes they're still actively enrolled in. Used by admin reschedule UI.
 */
export async function getStudentUpcomingLessons(
  studentId: string,
  days = 21,
): Promise<StudentLesson[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(today.getDate() + days);

  return db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      status: lessons.status,
      classId: classes.id,
      className: classes.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
      tutorId: profiles.id,
      tutorFirstName: profiles.firstName,
      tutorLastName: profiles.lastName,
      rescheduledFrom: lessons.rescheduledFrom,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, lessons.tutorId))
    .innerJoin(enrollments, eq(enrollments.classId, classes.id))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        isNull(enrollments.withdrawnAt),
        gte(lessons.date, isoDate(today)),
        lt(lessons.date, isoDate(horizon)),
      ),
    )
    .orderBy(asc(lessons.date), asc(lessons.startTime));
}

/**
 * Single lesson with subject/class/tutor context. Used by the reschedule
 * picker to confirm the lesson belongs to the student before showing slots.
 */
export async function getLessonContextForStudent(
  studentId: string,
  lessonId: string,
): Promise<StudentLesson | null> {
  const rows = await db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      status: lessons.status,
      classId: classes.id,
      className: classes.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
      tutorId: profiles.id,
      tutorFirstName: profiles.firstName,
      tutorLastName: profiles.lastName,
      rescheduledFrom: lessons.rescheduledFrom,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, lessons.tutorId))
    .innerJoin(enrollments, eq(enrollments.classId, classes.id))
    .where(
      and(
        eq(lessons.id, lessonId),
        eq(enrollments.studentId, studentId),
        isNull(enrollments.withdrawnAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export type DiscontinuedClass = {
  classId: string;
  className: string;
  subjectName: string;
  withdrawnAt: Date;
};

export type DiscontinuedStudent = {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  mostRecentWithdraw: Date;
  classes: DiscontinuedClass[];
};

/**
 * Students with at least one withdrawn enrolment, grouped so a student
 * withdrawn from N classes appears once with all N classes listed. Mirrors
 * the query in `src/app/admin/leaving/page.tsx` - used by the "Discontinued"
 * tab on `/admin/users`.
 */
export async function getDiscontinuedStudents(
  limit = 200,
): Promise<DiscontinuedStudent[]> {
  const rows = await db
    .select({
      studentId: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      phone: profiles.phone,
      classId: classes.id,
      className: classes.name,
      subjectName: subjects.name,
      withdrawnAt: enrollments.withdrawnAt,
    })
    .from(enrollments)
    .innerJoin(profiles, eq(profiles.id, enrollments.studentId))
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(isNotNull(enrollments.withdrawnAt))
    .orderBy(desc(enrollments.withdrawnAt))
    .limit(limit);

  const byStudent = new Map<string, DiscontinuedStudent>();
  for (const r of rows) {
    if (!r.withdrawnAt) continue;
    const classRecord: DiscontinuedClass = {
      classId: r.classId,
      className: r.className,
      subjectName: r.subjectName,
      withdrawnAt: r.withdrawnAt,
    };
    const existing = byStudent.get(r.studentId);
    if (existing) {
      existing.classes.push(classRecord);
      if (r.withdrawnAt > existing.mostRecentWithdraw) {
        existing.mostRecentWithdraw = r.withdrawnAt;
      }
    } else {
      byStudent.set(r.studentId, {
        studentId: r.studentId,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        phone: r.phone,
        mostRecentWithdraw: r.withdrawnAt,
        classes: [classRecord],
      });
    }
  }

  return Array.from(byStudent.values()).sort(
    (a, b) => b.mostRecentWithdraw.getTime() - a.mostRecentWithdraw.getTime(),
  );
}
