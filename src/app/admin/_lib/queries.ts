import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  notInArray,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { ADMIN_TIERS, STUDENT_TIERS } from "@/lib/roles";
import { formatDateLong } from "@/lib/format";
import {
  getAllowanceBonus,
  getCancellationsUsed,
  getReschedulesUsed,
  getTerms,
} from "@/lib/credits";
import {
  CANCEL_CAP,
  RESCHEDULE_CAP,
  deriveCreditStatus,
  resolveTerm,
  type CreditStatus,
} from "@/lib/reschedule-credits";
import {
  announcements,
  attendance,
  classCredits,
  classes,
  enrollments,
  homeworkAssignments,
  invoices,
  lessonCancellations,
  lessonNotes,
  lessons,
  profiles,
  rescheduleRequests,
  studentLeave,
  studentTrials,
  subjects,
  terms,
  tutorAvailability,
  tutorBankDetails,
  type UserRole,
} from "@/db/schema";

function isoDate(d: Date) {
  // Local calendar date, not UTC - matches local dates in lesson/date columns.
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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
  // Bucket by paidAt (cash received in the month), not issuedAt - a "Revenue"
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
      classId: classes.id,
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
      href: `/admin/classes/${r.classId}`,
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
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(today.getDate() + days);
  // Local calendar date (isoDate is UTC-based, which shifts the day boundary
  // and lets yesterday's lessons through in UTC+ timezones).
  const localIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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
        eq(enrollments.studentId, studentId),
        isNull(enrollments.withdrawnAt),
        gte(lessons.date, localIso(today)),
        lt(lessons.date, localIso(horizon)),
      ),
    )
    .orderBy(asc(lessons.date), asc(lessons.startTime));

  // Exclude lessons the student has been rescheduled or cancelled OUT of (they
  // hold an `absent` attendance on them), and any lesson that has already
  // started - neither is genuinely "upcoming" for this student.
  const absentRows = await db
    .select({ lessonId: attendance.lessonId })
    .from(attendance)
    .where(
      and(eq(attendance.studentId, studentId), eq(attendance.status, "absent")),
    );
  const absentIds = new Set(absentRows.map((a) => a.lessonId));

  return rows.filter(
    (l) =>
      !absentIds.has(l.id) &&
      new Date(`${l.date}T${l.startTime}`).getTime() > now.getTime(),
  );
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

export type DirectoryUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  yearLevel: string | null;
  school: string | null;
  isActive: boolean;
  /** Enrolments still live. Always 0 for non-students. */
  activeClasses: number;
  /** Enrolments the student has been withdrawn from. Always 0 for non-students. */
  withdrawnClasses: number;
  /** Most recent withdrawal date, or null if they have never withdrawn. */
  lastWithdrawnAt: Date | null;
};

/**
 * Every account plus the enrolment counts the directory needs to derive a
 * status. Powers `/admin/users`, whose Status filter replaced the old
 * "Discontinued" tab (and, before that, the standalone `/admin/leaving` page).
 */
export async function getUserDirectory(): Promise<DirectoryUser[]> {
  const [people, enrolmentTotals] = await Promise.all([
    db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        email: profiles.email,
        role: profiles.role,
        yearLevel: profiles.yearLevel,
        school: profiles.school,
        isActive: profiles.isActive,
      })
      .from(profiles),
    db
      .select({
        studentId: enrollments.studentId,
        activeClasses: sql<number>`count(*) filter (where ${enrollments.withdrawnAt} is null)`,
        withdrawnClasses: sql<number>`count(*) filter (where ${enrollments.withdrawnAt} is not null)`,
        lastWithdrawnAt: sql<Date | null>`max(${enrollments.withdrawnAt})`,
      })
      .from(enrollments)
      .groupBy(enrollments.studentId),
  ]);

  const totals = new Map(enrolmentTotals.map((t) => [t.studentId, t]));

  return people.map((p) => {
    const t = totals.get(p.id);
    return {
      ...p,
      activeClasses: Number(t?.activeClasses ?? 0),
      withdrawnClasses: Number(t?.withdrawnClasses ?? 0),
      lastWithdrawnAt: t?.lastWithdrawnAt ? new Date(t.lastWithdrawnAt) : null,
    };
  });
}

/**
 * An account is discontinued when it has been deactivated, or - for a student -
 * when every one of their enrolments has been withdrawn. A student withdrawn
 * from one class but still attending another stays active; their withdrawal is
 * surfaced on the row rather than in the status.
 */
export function directoryStatus(u: DirectoryUser): "active" | "discontinued" {
  if (!u.isActive) return "discontinued";
  return u.withdrawnClasses > 0 && u.activeClasses === 0
    ? "discontinued"
    : "active";
}

export type CreditRow = {
  id: string;
  studentId: string;
  studentFirst: string;
  studentLast: string;
  subjectName: string;
  /** Effective status derived at read time via `deriveCreditStatus`, not the
   *  raw stored column. */
  status: CreditStatus;
  grantReason: "cancellation" | "reschedule_no_slot" | "admin_grant";
  grantedFromLabel: string | null;
  redeemedOnLabel: string | null;
  expiresAt: string;
  createdAt: Date;
};

export type UsageRow = {
  studentId: string;
  studentFirst: string;
  studentLast: string;
  cancellationsUsed: number;
  reschedulesUsed: number;
  /** Effective per-term caps (base 3 + any admin allowance top-up). */
  cancellationCap: number;
  rescheduleCap: number;
};

export type CreditsOverview = {
  credits: CreditRow[];
  /** True when the credits list was cut off at the display cap - there are
   *  older credits not shown below. */
  creditsTruncated: boolean;
  usage: UsageRow[];
};

const CREDITS_DISPLAY_CAP = 300;

/**
 * Read-only admin visibility into the class-credits feature: every credit
 * ever granted (newest first, effective status derived at read time) plus a
 * compact per-student usage summary for the current term. Used by
 * `/admin/reschedules` - no grant/revoke controls here, that's out of scope.
 */
export async function getCreditsOverview(): Promise<CreditsOverview> {
  const student = alias(profiles, "credit_student");
  const fromLesson = alias(lessons, "credit_from_lesson");
  const redeemedLesson = alias(lessons, "credit_redeemed_lesson");

  // Fetch one row past the display cap so we can tell whether the list was
  // truncated - credit rows only ever accumulate (never deleted), so a plain
  // .limit(CREDITS_DISPLAY_CAP) would silently undercount forever once the
  // total passes the cap, with no signal to the admin that it's cut off.
  const creditRows = await db
    .select({
      id: classCredits.id,
      studentId: classCredits.studentId,
      studentFirst: student.firstName,
      studentLast: student.lastName,
      subjectName: subjects.name,
      status: classCredits.status,
      grantReason: classCredits.grantReason,
      expiresAt: classCredits.expiresAt,
      createdAt: classCredits.createdAt,
      fromDate: fromLesson.date,
      redeemedDate: redeemedLesson.date,
    })
    .from(classCredits)
    .innerJoin(student, eq(student.id, classCredits.studentId))
    .innerJoin(subjects, eq(subjects.id, classCredits.subjectId))
    .leftJoin(fromLesson, eq(fromLesson.id, classCredits.grantedFromLessonId))
    .leftJoin(
      redeemedLesson,
      eq(redeemedLesson.id, classCredits.redeemedOnLessonId),
    )
    .orderBy(desc(classCredits.createdAt))
    .limit(CREDITS_DISPLAY_CAP + 1);

  const creditsTruncated = creditRows.length > CREDITS_DISPLAY_CAP;
  if (creditsTruncated) creditRows.length = CREDITS_DISPLAY_CAP;

  const todayIso = isoDate(new Date());
  const credits: CreditRow[] = creditRows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    studentFirst: r.studentFirst,
    studentLast: r.studentLast,
    subjectName: r.subjectName,
    status: deriveCreditStatus(r.status, r.expiresAt, todayIso),
    grantReason: r.grantReason,
    grantedFromLabel: r.fromDate ? formatDateLong(r.fromDate) : null,
    redeemedOnLabel: r.redeemedDate ? formatDateLong(r.redeemedDate) : null,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
  }));

  // Usage is scoped to the term containing today - there is only ever one
  // (terms don't overlap), or none if today falls between terms.
  const currentTerm = resolveTerm(todayIso, await getTerms());
  let usage: UsageRow[] = [];

  if (currentTerm) {
    const studentIds = new Set<string>();

    const creditStudents = await db
      .selectDistinct({ studentId: classCredits.studentId })
      .from(classCredits)
      .where(eq(classCredits.termId, currentTerm.id));
    for (const r of creditStudents) studentIds.add(r.studentId);

    const cancelStudents = await db
      .selectDistinct({ studentId: lessonCancellations.studentId })
      .from(lessonCancellations)
      .where(eq(lessonCancellations.termId, currentTerm.id));
    for (const r of cancelStudents) studentIds.add(r.studentId);

    // Same self-serve-reschedule definition as `getReschedulesUsed`: approved
    // requests whose original lesson falls in the term and whose requester is
    // not an admin (admin-initiated moves aren't self-serve usage).
    const rescheduleStudents = await db
      .selectDistinct({ studentId: rescheduleRequests.studentId })
      .from(rescheduleRequests)
      .innerJoin(lessons, eq(lessons.id, rescheduleRequests.originalLessonId))
      .innerJoin(profiles, eq(profiles.id, rescheduleRequests.requestedById))
      .where(
        and(
          eq(rescheduleRequests.status, "approved"),
          gte(lessons.date, currentTerm.startDate),
          lte(lessons.date, currentTerm.endDate),
          notInArray(profiles.role, [...ADMIN_TIERS]),
        ),
      );
    for (const r of rescheduleStudents) studentIds.add(r.studentId);

    if (studentIds.size > 0) {
      const ids = Array.from(studentIds);
      const studentRows = await db
        .select({
          id: profiles.id,
          firstName: profiles.firstName,
          lastName: profiles.lastName,
        })
        .from(profiles)
        .where(inArray(profiles.id, ids));
      const nameById = new Map(studentRows.map((s) => [s.id, s]));

      usage = await Promise.all(
        ids.map(async (studentId) => {
          const [cancellationsUsed, reschedulesUsed, bonus] = await Promise.all([
            getCancellationsUsed(studentId, currentTerm.id),
            getReschedulesUsed(studentId, currentTerm.id),
            getAllowanceBonus(studentId, currentTerm.id),
          ]);
          const name = nameById.get(studentId);
          return {
            studentId,
            studentFirst: name?.firstName ?? "",
            studentLast: name?.lastName ?? "",
            cancellationsUsed,
            reschedulesUsed,
            cancellationCap: CANCEL_CAP + bonus.cancellation,
            rescheduleCap: RESCHEDULE_CAP + bonus.reschedule,
          };
        }),
      );
      usage.sort((a, b) =>
        `${a.studentFirst} ${a.studentLast}`.localeCompare(
          `${b.studentFirst} ${b.studentLast}`,
        ),
      );
    }
  }

  return { credits, creditsTruncated, usage };
}

export type StudentLeaveRow = {
  id: string;
  startDate: string;
  endDate: string;
  note: string | null;
};

/** A student's leave/holiday periods, most recent first. */
export async function getStudentLeave(
  studentId: string,
): Promise<StudentLeaveRow[]> {
  return db
    .select({
      id: studentLeave.id,
      startDate: studentLeave.startDate,
      endDate: studentLeave.endDate,
      note: studentLeave.note,
    })
    .from(studentLeave)
    .where(eq(studentLeave.studentId, studentId))
    .orderBy(desc(studentLeave.startDate));
}

export type TutorAvailabilitySlot = {
  /** 0 = Sunday … 6 = Saturday (JS getDay convention, matching expandAvailability). */
  weekday: number;
  startTime: string;
  endTime: string;
};

export type TutorWeeklyAvailability = {
  tutorId: string;
  firstName: string;
  lastName: string;
  slots: TutorAvailabilitySlot[];
};

/**
 * Every active tutor with their recurring weekly availability, for the admin
 * read-only roster board at /admin/tutors/availability.
 *
 * Only the recurring weekly rules are surfaced (weekday not null, isAvailable
 * true) - the standing pattern reception coordinates cover against. Per-date
 * overrides / day-isolation sentinels are deliberately excluded: they are a
 * concrete-date concept and do not belong on a weekly recurring board.
 *
 * Tutors with no availability rows are still returned (empty `slots`) so gaps
 * in the roster are visible rather than silently dropped.
 */
export async function getTutorWeeklyAvailabilityBoard(): Promise<
  TutorWeeklyAvailability[]
> {
  const rows = await db
    .select({
      tutorId: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      weekday: tutorAvailability.weekday,
      startTime: tutorAvailability.startTime,
      endTime: tutorAvailability.endTime,
    })
    .from(profiles)
    .leftJoin(
      tutorAvailability,
      and(
        eq(tutorAvailability.tutorId, profiles.id),
        isNull(tutorAvailability.date),
        eq(tutorAvailability.isAvailable, true),
      ),
    )
    .where(and(eq(profiles.role, "tutor"), eq(profiles.isActive, true)))
    .orderBy(asc(profiles.firstName), asc(profiles.lastName));

  const byTutor = new Map<string, TutorWeeklyAvailability>();
  for (const r of rows) {
    let tutor = byTutor.get(r.tutorId);
    if (!tutor) {
      tutor = {
        tutorId: r.tutorId,
        firstName: r.firstName,
        lastName: r.lastName,
        slots: [],
      };
      byTutor.set(r.tutorId, tutor);
    }
    if (r.weekday === null || r.startTime === null || r.endTime === null) {
      continue;
    }
    // Dedup identical (weekday, start, end) rows so a duplicated rule renders once.
    const dup = tutor.slots.some(
      (s) =>
        s.weekday === r.weekday &&
        s.startTime === r.startTime &&
        s.endTime === r.endTime,
    );
    if (!dup) {
      tutor.slots.push({
        weekday: r.weekday,
        startTime: r.startTime,
        endTime: r.endTime,
      });
    }
  }

  for (const tutor of byTutor.values()) {
    tutor.slots.sort(
      (a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime),
    );
  }

  return Array.from(byTutor.values());
}

export type TutorDirectoryEntry = {
  tutorId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  subjects: string[];
  classes: Array<{
    classId: string;
    className: string;
    subjectName: string;
    weekday: number | null;
    startTime: string | null;
    endTime: string | null;
  }>;
  bank: {
    accountName: string | null;
    bsb: string | null;
    accountNumber: string | null;
    note: string | null;
  } | null;
};

/**
 * Owner-only tutor directory: every active tutor with the subjects they teach
 * (derived from their assigned classes), their class schedule, and their
 * payroll bank details (migration 0035). PII - the page that calls this is
 * gated by requireUnrestrictedAdmin().
 */
export async function getTutorDirectory(): Promise<TutorDirectoryEntry[]> {
  const tutors = await db
    .select({
      tutorId: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      phone: profiles.phone,
    })
    .from(profiles)
    .where(and(eq(profiles.role, "tutor"), eq(profiles.isActive, true)))
    .orderBy(asc(profiles.firstName), asc(profiles.lastName));
  if (tutors.length === 0) return [];

  const tutorIds = tutors.map((t) => t.tutorId);

  const classRows = await db
    .select({
      tutorId: classes.tutorId,
      classId: classes.id,
      className: classes.name,
      subjectName: subjects.name,
      weekday: classes.weekday,
      startTime: classes.startTime,
      endTime: classes.endTime,
    })
    .from(classes)
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(inArray(classes.tutorId, tutorIds))
    .orderBy(asc(classes.weekday), asc(classes.startTime));

  const bankRows = await db
    .select()
    .from(tutorBankDetails)
    .where(inArray(tutorBankDetails.tutorId, tutorIds));
  const bankByTutor = new Map(bankRows.map((b) => [b.tutorId, b]));

  const classesByTutor = new Map<string, TutorDirectoryEntry["classes"]>();
  const subjectsByTutor = new Map<string, Set<string>>();
  for (const c of classRows) {
    if (!classesByTutor.has(c.tutorId)) classesByTutor.set(c.tutorId, []);
    classesByTutor.get(c.tutorId)!.push({
      classId: c.classId,
      className: c.className,
      subjectName: c.subjectName,
      weekday: c.weekday,
      startTime: c.startTime,
      endTime: c.endTime,
    });
    if (!subjectsByTutor.has(c.tutorId)) subjectsByTutor.set(c.tutorId, new Set());
    subjectsByTutor.get(c.tutorId)!.add(c.subjectName);
  }

  return tutors.map((t) => {
    const bank = bankByTutor.get(t.tutorId);
    return {
      tutorId: t.tutorId,
      firstName: t.firstName,
      lastName: t.lastName,
      email: t.email,
      phone: t.phone,
      subjects: Array.from(subjectsByTutor.get(t.tutorId) ?? []).sort(),
      classes: classesByTutor.get(t.tutorId) ?? [],
      bank: bank
        ? {
            accountName: bank.accountName,
            bsb: bank.bsb,
            accountNumber: bank.accountNumber,
            note: bank.note,
          }
        : null,
    };
  });
}

export type FinancialReportLine = {
  id: string;
  parentName: string;
  amount: string;
  currency: string;
  date: string | null;
  status: string;
  description: string | null;
};

export type FinancialReport = {
  fromIso: string;
  toIso: string;
  revenueTotal: number;
  paymentCount: number;
  overdueTotal: number;
  overdueCount: number;
  currency: string;
  payments: FinancialReportLine[];
  overdue: FinancialReportLine[];
};

/**
 * Financial figures for the downloadable revenue report over a date range.
 * `from` is the inclusive start (local midnight); `to` is the EXCLUSIVE end
 * (local midnight of the day after the last day). Revenue = invoices whose
 * payment landed (paidAt) in [from, to); overdue = still-owing invoices past
 * their due date as of the end. The returned `toIso` is the inclusive last day
 * (to - 1 day) for display. Caller must already be behind the revenue PIN gate.
 */
export async function getFinancialReport(
  from: Date,
  to: Date,
): Promise<FinancialReport> {
  const parent = alias(profiles, "invoice_parent");
  const toExclusiveIso = isoDate(to);
  const displayToIso = isoDate(new Date(to.getTime() - 86400000));

  const paymentRows = await db
    .select({
      id: invoices.id,
      amount: invoices.amount,
      currency: invoices.currency,
      date: invoices.paidAt,
      status: invoices.status,
      description: invoices.description,
      parentFirst: parent.firstName,
      parentLast: parent.lastName,
    })
    .from(invoices)
    .innerJoin(parent, eq(parent.id, invoices.parentId))
    .where(
      and(
        eq(invoices.status, "paid"),
        gte(invoices.paidAt, from),
        lt(invoices.paidAt, to),
      ),
    )
    .orderBy(desc(invoices.paidAt));

  const overdueRows = await db
    .select({
      id: invoices.id,
      amount: invoices.amount,
      currency: invoices.currency,
      date: invoices.dueDate,
      status: invoices.status,
      description: invoices.description,
      parentFirst: parent.firstName,
      parentLast: parent.lastName,
    })
    .from(invoices)
    .innerJoin(parent, eq(parent.id, invoices.parentId))
    .where(
      and(
        sql`${invoices.status} in ('unpaid','overdue','partially_paid')`,
        lt(invoices.dueDate, toExclusiveIso),
      ),
    )
    .orderBy(asc(invoices.dueDate));

  const toLine = (r: {
    id: string;
    amount: string;
    currency: string;
    date: Date | string | null;
    status: string;
    description: string | null;
    parentFirst: string;
    parentLast: string;
  }): FinancialReportLine => ({
    id: r.id,
    parentName: `${r.parentFirst} ${r.parentLast}`.trim(),
    amount: r.amount,
    currency: r.currency,
    date:
      r.date instanceof Date
        ? isoDate(r.date)
        : typeof r.date === "string"
          ? r.date
          : null,
    status: r.status,
    description: r.description,
  });

  const payments = paymentRows.map(toLine);
  const overdue = overdueRows.map(toLine);
  const revenueTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
  const overdueTotal = overdue.reduce((s, p) => s + Number(p.amount), 0);

  return {
    fromIso: isoDate(from),
    toIso: displayToIso,
    revenueTotal,
    paymentCount: payments.length,
    overdueTotal,
    overdueCount: overdue.length,
    currency: payments[0]?.currency ?? overdue[0]?.currency ?? "AUD",
    payments,
    overdue,
  };
}

export type ReportTerm = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

/** Terms (newest first) for the financial-report period picker. */
export async function getReportTerms(): Promise<ReportTerm[]> {
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
    label: `${t.year} · Term ${t.termNumber}`,
    startDate: t.startDate,
    endDate: t.endDate,
  }));
}

export type StudentTrialRow = {
  startDate: string;
  endDate: string;
  note: string | null;
};

/** A student's free-trial period, or null if none is set. */
export async function getStudentTrial(
  studentId: string,
): Promise<StudentTrialRow | null> {
  const [row] = await db
    .select({
      startDate: studentTrials.startDate,
      endDate: studentTrials.endDate,
      note: studentTrials.note,
    })
    .from(studentTrials)
    .where(eq(studentTrials.studentId, studentId))
    .limit(1);
  return row ?? null;
}
