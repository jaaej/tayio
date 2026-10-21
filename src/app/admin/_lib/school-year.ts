import "server-only";

import { and, eq, gt, inArray, isNull, notInArray, or } from "drizzle-orm";
import { db } from "@/db/client";
import {
  attendance,
  classCredits,
  classMoveRequests,
  enrollments,
  familyLinks,
  invoices,
  lessonRollAdditions,
  lessons,
  profiles,
  rescheduleRequests,
  schoolYearEnds,
  terms,
} from "@/db/schema";
import { STUDENT_TIERS } from "@/lib/roles";
import {
  finalYearStudents,
  planRollover,
  schoolYearToEnd,
  type RolloverStudent,
} from "@/lib/school-year-rules";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { addIsoDays } from "@/lib/tutor-checkin-rules";
import { othersOnLesson } from "@/lib/lesson-guests";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = typeof db | DbTx;

/** Invoices a family still has to pay; a parent who has one keeps their login. */
const OPEN_INVOICE = ["unpaid", "overdue", "partially_paid"] as const;

/** Active student accounts with their year levels, by name. */
export async function activeStudents(reader: Reader = db): Promise<RolloverStudent[]> {
  const rows = await reader
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      yearLevel: profiles.yearLevel,
    })
    .from(profiles)
    .where(and(inArray(profiles.role, STUDENT_TIERS), eq(profiles.isActive, true)))
    .orderBy(profiles.firstName, profiles.lastName);
  return rows.map((r) => ({
    id: r.id,
    name: `${r.firstName} ${r.lastName}`.trim(),
    yearLevel: r.yearLevel,
  }));
}

/**
 * Parents to archive along with these students: those with no other active
 * child and no invoice still to pay. A parent with an open invoice keeps
 * their login so they can still see and pay it.
 */
export async function parentsLeavingWith(
  reader: Reader,
  studentIds: string[],
): Promise<{ archive: { id: string; name: string }[]; keptForInvoices: { id: string; name: string }[] }> {
  if (studentIds.length === 0) return { archive: [], keptForInvoices: [] };
  const parents = await reader
    .selectDistinct({ id: profiles.id, firstName: profiles.firstName, lastName: profiles.lastName })
    .from(familyLinks)
    .innerJoin(profiles, eq(profiles.id, familyLinks.parentId))
    .where(and(inArray(familyLinks.studentId, studentIds), eq(profiles.isActive, true)));
  if (parents.length === 0) return { archive: [], keptForInvoices: [] };
  const parentIds = parents.map((p) => p.id);

  const [otherChildren, openInvoices] = await Promise.all([
    reader
      .selectDistinct({ parentId: familyLinks.parentId })
      .from(familyLinks)
      .innerJoin(profiles, eq(profiles.id, familyLinks.studentId))
      .where(
        and(
          inArray(familyLinks.parentId, parentIds),
          eq(profiles.isActive, true),
          notInArray(familyLinks.studentId, studentIds),
        ),
      ),
    reader
      .selectDistinct({ parentId: invoices.parentId })
      .from(invoices)
      .where(and(inArray(invoices.parentId, parentIds), inArray(invoices.status, [...OPEN_INVOICE]))),
  ]);
  const staying = new Set(otherChildren.map((r) => r.parentId));
  const owing = new Set(openInvoices.map((r) => r.parentId));
  const name = (p: (typeof parents)[number]) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`.trim() });
  return {
    archive: parents.filter((p) => !staying.has(p.id) && !owing.has(p.id)).map(name),
    keptForInvoices: parents.filter((p) => !staying.has(p.id) && owing.has(p.id)).map(name),
  };
}

/**
 * Archive students who have finished school, inside the caller's
 * transaction: their accounts are deactivated, they leave every class, and
 * what they had booked after today is undone (make-ups, moves and pending
 * requests), so they drop off future rolls and the admin queues. Lessons
 * that have run, attendance, notes, homework and invoices stay. The caller
 * bans their logins in Supabase Auth after the transaction commits.
 */
export async function archiveStudentsInTx(
  tx: DbTx,
  studentIds: string[],
  parentIds: string[],
): Promise<void> {
  if (studentIds.length === 0) return;
  const now = new Date();
  const today = melbourneDate(now);
  const futureLessons = tx.select({ id: lessons.id }).from(lessons).where(gt(lessons.date, today));

  // Make-ups booked on a future private lesson (a move or a credit): once
  // their bookings are undone below, the lesson is cancelled when nobody
  // else is on it, as cancelling a move does.
  const [futureMoves, futureCredits] = await Promise.all([
    tx
      .select({ lessonId: rescheduleRequests.targetLessonId })
      .from(rescheduleRequests)
      .where(
        and(
          inArray(rescheduleRequests.studentId, studentIds),
          eq(rescheduleRequests.status, "approved"),
          inArray(rescheduleRequests.targetLessonId, futureLessons),
        ),
      ),
    tx
      .select({ lessonId: classCredits.redeemedOnLessonId })
      .from(classCredits)
      .where(
        and(
          inArray(classCredits.studentId, studentIds),
          eq(classCredits.status, "redeemed"),
          inArray(classCredits.redeemedOnLessonId, futureLessons),
        ),
      ),
  ]);
  const bookedLessonIds = new Set(
    [...futureMoves, ...futureCredits].map((m) => m.lessonId).filter((id): id is string => !!id),
  );

  await tx
    .delete(attendance)
    .where(and(inArray(attendance.studentId, studentIds), inArray(attendance.lessonId, futureLessons)));
  await tx
    .delete(lessonRollAdditions)
    .where(and(inArray(lessonRollAdditions.studentId, studentIds), inArray(lessonRollAdditions.lessonId, futureLessons)));

  await tx
    .update(rescheduleRequests)
    .set({ status: "cancelled" })
    .where(
      and(
        inArray(rescheduleRequests.studentId, studentIds),
        or(
          eq(rescheduleRequests.status, "pending"),
          and(
            eq(rescheduleRequests.status, "approved"),
            inArray(rescheduleRequests.targetLessonId, futureLessons),
          ),
        ),
      ),
    );

  // A credit spent on a future lesson is unspent again; it expires on its own.
  await tx
    .update(classCredits)
    .set({ status: "active", redeemedOnLessonId: null, redeemedById: null, redeemedAt: null })
    .where(
      and(
        inArray(classCredits.studentId, studentIds),
        eq(classCredits.status, "redeemed"),
        inArray(classCredits.redeemedOnLessonId, futureLessons),
      ),
    );

  for (const lessonId of bookedLessonIds) {
    if (!(await othersOnLesson(tx, lessonId, studentIds))) {
      await tx
        .update(lessons)
        .set({ status: "cancelled" })
        .where(and(eq(lessons.id, lessonId), eq(lessons.status, "makeup")));
    }
  }

  await tx
    .update(classMoveRequests)
    .set({ status: "cancelled", decidedAt: now, updatedAt: now })
    .where(and(inArray(classMoveRequests.studentId, studentIds), eq(classMoveRequests.status, "pending")));

  await tx
    .update(enrollments)
    .set({ withdrawnAt: now, endsOn: addIsoDays(today, 1) })
    .where(and(inArray(enrollments.studentId, studentIds), isNull(enrollments.withdrawnAt)));

  await tx
    .update(profiles)
    .set({ isActive: false, updatedAt: now })
    .where(inArray(profiles.id, [...studentIds, ...parentIds]));
}

/** The row for a school year, locked for the rest of the transaction. */
export async function lockSchoolYearEnd(tx: DbTx, schoolYear: number) {
  await tx.insert(schoolYearEnds).values({ schoolYear }).onConflictDoNothing();
  const [row] = await tx
    .select()
    .from(schoolYearEnds)
    .where(eq(schoolYearEnds.schoolYear, schoolYear))
    .for("update");
  return row;
}

export type SchoolYearEndView = {
  year: number;
  finalTerm: { termNumber: number; endDate: string };
  termEnded: boolean;
  /** Set once every student has moved up; then nothing more can be done. */
  rolledOver: { at: Date; moved: number } | null;
  archivedCount: number;
  year12: RolloverStudent[];
  year12Parents: Awaited<ReturnType<typeof parentsLeavingWith>>;
  plan: ReturnType<typeof planRollover>;
  planParents: Awaited<ReturnType<typeof parentsLeavingWith>>;
};

/** What the Terms page's End of school year panel shows, or null outside its window. */
export async function getSchoolYearEnd(): Promise<SchoolYearEndView | null> {
  const today = melbourneDate(new Date());
  const termRows = await db
    .select({ year: terms.year, termNumber: terms.termNumber, startDate: terms.startDate, endDate: terms.endDate })
    .from(terms);
  const window = schoolYearToEnd(termRows, today);
  if (!window) return null;

  const [record] = await db
    .select()
    .from(schoolYearEnds)
    .where(eq(schoolYearEnds.schoolYear, window.year));
  const students = await activeStudents();
  const year12 = finalYearStudents(students);
  const plan = planRollover(students);
  const [year12Parents, planParents] = await Promise.all([
    parentsLeavingWith(db, year12.map((s) => s.id)),
    parentsLeavingWith(db, plan.finishing.map((s) => s.id)),
  ]);
  return {
    year: window.year,
    finalTerm: { termNumber: window.finalTerm.termNumber, endDate: window.finalTerm.endDate },
    termEnded: window.termEnded,
    rolledOver: record?.rolledOverAt ? { at: record.rolledOverAt, moved: record.moved.length } : null,
    archivedCount: record?.archivedStudentIds.length ?? 0,
    year12,
    year12Parents,
    plan,
    planParents,
  };
}

/** Students already in a school year's record, so a re-run adds to it. */
export function mergeIds(existing: string[], added: string[]): string[] {
  return [...new Set([...existing, ...added])];
}

