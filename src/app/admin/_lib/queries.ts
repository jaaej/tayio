import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
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
