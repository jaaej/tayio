"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classCredits,
  classes,
  classMoveRequests,
  discussionThreads,
  enrollments,
  homework,
  homeworkAssignments,
  lessons,
  notifications,
  profiles,
  progressTopics,
  quizAttempts,
  quizzes,
  studentWeekProgress,
  subjects,
  subjectWeeks,
} from "@/db/schema";
import { coarseRole } from "@/lib/roles";
import { requireAdmin } from "./guard";
import { withActor } from "@/lib/with-actor";
import { ensureRecurringLessons } from "@/lib/recurring-lessons";
import { classDisplayName } from "@/lib/class-display";
import { slotClassName, weeklySlotLabel } from "@/lib/class-schedule-change";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { SUBJECT_COLORS, defaultSubjectColor } from "@/lib/subject-tone";
import { oneOnOneError } from "@/lib/class-capacity";
import { classFamilies } from "./class-lessons";
import { applyClassEdit, insertClass, patchTimeError } from "./class-writes";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const subjectFields = z.object({
  name: z.string().trim().min(1, "Enter a subject name.").max(200),
  yearLevel: z.string().trim().max(40).optional(),
  color: z.enum(SUBJECT_COLORS).optional(),
});

function revalidateSubjects() {
  revalidatePath("/admin/classes");
  // Subject names, colours and classes show in every portal.
  revalidatePath("/", "layout");
}

export async function createSubject(
  input: z.input<typeof subjectFields>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireAdmin();
  const parsed = subjectFields.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;
  // Names may repeat (two "Mathematics" for different year levels); a subject
  // is its id, and lists show the level beside the name.
  const [row] = await withActor({ id: user.id, role: "admin" }, (tx) =>
    tx
      .insert(subjects)
      .values({
        name: data.name,
        yearLevel: data.yearLevel || null,
        color: data.color ?? defaultSubjectColor(data.name),
      })
      .returning({ id: subjects.id }),
  );
  revalidateSubjects();
  return { ok: true, id: row.id };
}

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

/** Students joining or leaving a class. */
const studentChangesSchema = z.object({
  add: z.array(z.string().uuid()).max(200),
  withdraw: z.array(z.string().uuid()).max(200),
});

/**
 * One class card on the edit page. `id` is missing for an added class. The
 * detail fields are sent only when changed; a missing one keeps its value.
 */
const classCardSchema = z.object({
  key: z.string().min(1).max(64),
  id: z.string().uuid().optional(),
  weekday: z.number().int().min(0).max(6).nullable(),
  startTime: z.string().regex(timeRegex).or(z.literal("")),
  endTime: z.string().regex(timeRegex).or(z.literal("")),
  tutorId: z.string().uuid(),
  location: z.string().max(200),
  name: z.string().trim().min(1).max(200).optional(),
  classType: z.enum(["group", "one_on_one"]).optional(),
  capacity: z.number().int().min(1).max(200).optional(),
  students: studentChangesSchema.optional(),
});

const subjectPageSchema = subjectFields.extend({
  id: z.string().uuid(),
  color: z.enum(SUBJECT_COLORS),
  classes: z.array(classCardSchema).max(50),
});

export type SubjectPageResult =
  | { ok: true }
  | { ok: false; error?: string; classErrors?: Record<string, string> };

type StudentChanges = z.infer<typeof studentChangesSchema>;

/**
 * Apply a card's student changes inside the save's transaction: a joining
 * student is enrolled (or re-enrolled after leaving), and a leaving one is
 * withdrawn (attendance and notes are kept).
 */
async function applyStudentChanges(tx: DbTx, classId: string, changes: StudentChanges) {
  if (changes.add.length > 0) {
    const accounts = await tx
      .select({ id: profiles.id, role: profiles.role })
      .from(profiles)
      .where(inArray(profiles.id, changes.add));
    const students = new Set(
      accounts.filter((a) => coarseRole(a.role) === "student").map((a) => a.id),
    );
    if (changes.add.some((id) => !students.has(id))) throw new NotAStudent();

    const existing = await tx
      .select({ studentId: enrollments.studentId })
      .from(enrollments)
      .where(and(eq(enrollments.classId, classId), inArray(enrollments.studentId, changes.add)));
    const known = new Set(existing.map((e) => e.studentId));
    const rejoining = changes.add.filter((id) => known.has(id));
    const joining = changes.add.filter((id) => !known.has(id));
    if (rejoining.length > 0) {
      await tx
        .update(enrollments)
        .set({ withdrawnAt: null, enrolledAt: new Date() })
        .where(
          and(
            eq(enrollments.classId, classId),
            inArray(enrollments.studentId, rejoining),
            isNotNull(enrollments.withdrawnAt),
          ),
        );
    }
    if (joining.length > 0) {
      await tx
        .insert(enrollments)
        .values(joining.map((studentId) => ({ classId, studentId })));
    }
  }

  if (changes.withdraw.length > 0) {
    await tx
      .update(enrollments)
      .set({ withdrawnAt: new Date() })
      .where(
        and(
          eq(enrollments.classId, classId),
          inArray(enrollments.studentId, changes.withdraw),
          isNull(enrollments.withdrawnAt),
        ),
      );
  }
}

class NotAStudent extends Error {}

/** A one-on-one card would end the save with more than one student. */
class OneOnOneFull extends Error {
  constructor(readonly key: string, message: string) {
    super(message);
  }
}

/** Refuse the save when a one-on-one class would hold more than one student. */
async function assertOneOnOne(tx: DbTx, classId: string, key: string) {
  const [row] = await tx
    .select({
      classType: classes.classType,
      students: sql<number>`(select count(*) from ${enrollments} where ${enrollments.classId} = ${classes.id} and ${enrollments.withdrawnAt} is null)::int`,
    })
    .from(classes)
    .where(eq(classes.id, classId));
  const error = row && oneOnOneError(row.classType, row.students);
  if (error) throw new OneOnOneFull(key, error);
}

/**
 * The edit page's one Save: the subject and every class card together, in
 * one transaction, so a refused card leaves nothing half saved. Class edits
 * go through applyClassEdit (lessons follow, families are told).
 */
export async function saveSubjectPage(
  input: z.input<typeof subjectPageSchema>,
): Promise<SubjectPageResult> {
  const user = await requireAdmin();
  const parsed = subjectPageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some fields are not valid. Check and try again." };
  const data = parsed.data;

  const classErrors: Record<string, string> = {};
  const cards = data.classes.map((card) => {
    const weekly = card.weekday !== null;
    const patch = {
      tutorId: card.tutorId,
      isRecurring: weekly,
      weekday: card.weekday,
      startTime: card.startTime || null,
      endTime: card.endTime || null,
      location: card.location,
      ...(card.name !== undefined && { name: card.name }),
      ...(card.classType !== undefined && { classType: card.classType }),
      ...(card.capacity !== undefined && { capacity: card.capacity }),
    };
    const error =
      weekly && (!card.startTime || !card.endTime)
        ? "Choose a start and end time."
        : patchTimeError(patch);
    if (error) classErrors[card.key] = error;
    return { card, patch };
  });
  if (Object.keys(classErrors).length > 0) return { ok: false, classErrors };

  const now = new Date();
  let touched: string[];
  try {
    touched = await withActor({ id: user.id, role: "admin" }, async (tx) => {
      const updated = await tx
        .update(subjects)
        .set({ name: data.name, yearLevel: data.yearLevel || null, color: data.color })
        .where(eq(subjects.id, data.id))
        .returning({ id: subjects.id });
      if (updated.length === 0) throw new SubjectGone();

      const ids: string[] = [];
      for (const { card, patch } of cards) {
        let classId: string;
        if (card.id) {
          const [owned] = await tx
            .select({ id: classes.id })
            .from(classes)
            .where(and(eq(classes.id, card.id), eq(classes.subjectId, data.id)));
          if (!owned) continue; // deleted since the page loaded
          await applyClassEdit(tx, card.id, patch, now);
          classId = card.id;
        } else {
          // Named like the other classes ("Year 9 Maths · Friday PM") unless
          // the admin typed a name.
          const dayName = slotClassName({ ...patch, location: null });
          classId = await insertClass(tx, {
            ...patch,
            name: patch.name ?? `${data.name} · ${dayName ?? "Class"}`,
            subjectId: data.id,
          });
        }
        if (card.students) await applyStudentChanges(tx, classId, card.students);
        await assertOneOnOne(tx, classId, card.key);
        ids.push(classId);
      }
      return ids;
    });
  } catch (error) {
    if (error instanceof SubjectGone) return { ok: false, error: "This subject no longer exists." };
    if (error instanceof OneOnOneFull) return { ok: false, classErrors: { [error.key]: error.message } };
    if (error instanceof NotAStudent) {
      return { ok: false, error: "One of the students to add no longer has a student account." };
    }
    throw error;
  }

  try {
    await ensureRecurringLessons({ classIds: touched });
  } catch (error) {
    // The daily sweep retries; the saved classes are valid.
    console.error("[subjects] recurring lesson generation failed:", error);
  }
  revalidateSubjects();
  return { ok: true };
}

class SubjectGone extends Error {}

export type SubjectDeletionImpact = {
  classes: number;
  /** Lessons that have already run, with their attendance. */
  lessons: number;
  weeks: number;
  homework: number;
  /** Students whose progress in this subject is lost. */
  students: number;
  /** Make-up credits not yet used or expired. */
  openCredits: number;
  /** Any of its classes has run. */
  hasHistory: boolean;
};

/** The subject's classes and curriculum weeks, as id lists. */
async function subjectScope(tx: DbTx, id: string) {
  const [classRows, weekRows] = await Promise.all([
    tx.select({ id: classes.id }).from(classes).where(eq(classes.subjectId, id)),
    tx.select({ id: subjectWeeks.id }).from(subjectWeeks).where(eq(subjectWeeks.subjectId, id)),
  ]);
  return { classIds: classRows.map((r) => r.id), weekIds: weekRows.map((r) => r.id) };
}

/** Homework set for the subject's classes or its curriculum weeks. */
function subjectHomework(classIds: string[], weekIds: string[]) {
  const parts = [
    classIds.length ? inArray(homework.classId, classIds) : undefined,
    weekIds.length ? inArray(homework.weekId, weekIds) : undefined,
  ].filter((p) => p !== undefined);
  return parts.length ? or(...parts) : undefined;
}

async function subjectDeletionImpact(tx: DbTx, id: string): Promise<SubjectDeletionImpact> {
  const { classIds, weekIds } = await subjectScope(tx, id);
  const count = sql<number>`count(*)::int`;
  const today = melbourneDate(new Date());
  const homeworkWhere = subjectHomework(classIds, weekIds);

  const [[ran], [hw], [credits], studentRows] = await Promise.all([
    classIds.length
      ? tx
          .select({ n: count })
          .from(lessons)
          .where(
            and(
              inArray(lessons.classId, classIds),
              sql`${lessons.status} <> 'cancelled'`,
              sql`(${lessons.date} < ${today} or ${lessons.status} in ('completed', 'missed'))`,
            ),
          )
      : [{ n: 0 }],
    homeworkWhere ? tx.select({ n: count }).from(homework).where(homeworkWhere) : [{ n: 0 }],
    tx
      .select({ n: count })
      .from(classCredits)
      .where(and(eq(classCredits.subjectId, id), eq(classCredits.status, "active"))),
    // Everyone with something recorded in the subject.
    tx.execute<{ id: string }>(sql`
      select student_id as id from ${enrollments}
        where ${classIds.length ? inArray(enrollments.classId, classIds) : sql`false`}
      union
      select student_id from ${studentWeekProgress}
        where ${weekIds.length ? inArray(studentWeekProgress.subjectWeekId, weekIds) : sql`false`}
      union
      select ${quizAttempts.studentId} from ${quizAttempts}
        join ${quizzes} on ${quizzes.id} = ${quizAttempts.quizId}
        where ${quizzes.subjectId} = ${id}
      union
      select ${homeworkAssignments.studentId} from ${homeworkAssignments}
        join ${homework} on ${homework.id} = ${homeworkAssignments.homeworkId}
        where ${homeworkWhere ?? sql`false`}
    `),
  ]);
  return {
    classes: classIds.length,
    lessons: ran?.n ?? 0,
    weeks: weekIds.length,
    homework: hw?.n ?? 0,
    students: studentRows.length,
    openCredits: credits?.n ?? 0,
    hasHistory: (ran?.n ?? 0) > 0,
  };
}

/** What deleting the subject would remove, for its confirmation. */
export async function getSubjectDeletionImpact(
  id: string,
): Promise<{ ok: true; impact: SubjectDeletionImpact }> {
  await requireAdmin();
  z.string().uuid().parse(id);
  const impact = await db.transaction((tx) => subjectDeletionImpact(tx, id));
  return { ok: true, impact };
}

const deleteSubjectSchema = z.object({
  id: z.string().uuid(),
  confirmName: z.string().max(200),
});

/**
 * Delete a subject with everything in it: its classes and their lessons and
 * attendance, its curriculum, homework and marks, and its discussions.
 * Invoices are kept (they reference only people). The subject name must be
 * typed, checked here as well as in the dialog.
 */
export async function deleteSubject(
  input: z.infer<typeof deleteSubjectSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireAdmin();
  const { id, confirmName } = deleteSubjectSchema.parse(input);
  const now = new Date();

  const result = await withActor({ id: user.id, role: "admin" }, async (tx) => {
    const [subject] = await tx
      .select({ name: subjects.name })
      .from(subjects)
      .where(eq(subjects.id, id))
      .for("update");
    if (!subject) return { ok: false as const, error: "This subject no longer exists." };
    if (confirmName.trim() !== subject.name.trim()) {
      return { ok: false as const, error: "Type the subject name exactly to delete it." };
    }

    const { classIds, weekIds } = await subjectScope(tx, id);

    // Families and tutors of classes with lessons still to come, told below.
    const affected = classIds.length
      ? await tx
          .select({
            id: classes.id,
            name: classes.name,
            tutorId: classes.tutorId,
            isRecurring: classes.isRecurring,
            weekday: classes.weekday,
            startTime: classes.startTime,
            endTime: classes.endTime,
            location: classes.location,
          })
          .from(classes)
          .where(
            and(
              inArray(classes.id, classIds),
              sql`exists (select 1 from ${lessons} where ${lessons.classId} = ${classes.id} and ${lessons.date} >= ${melbourneDate(now)} and ${lessons.status} = 'upcoming')`,
            ),
          )
      : [];
    const told = await Promise.all(
      affected.map(async (c) => ({ cls: c, families: await classFamilies(tx, c.id) })),
    );

    const homeworkWhere = subjectHomework(classIds, weekIds);
    if (homeworkWhere) await tx.delete(homework).where(homeworkWhere);
    if (classIds.length) {
      await tx
        .delete(classMoveRequests)
        .where(
          or(
            inArray(classMoveRequests.fromClassId, classIds),
            inArray(classMoveRequests.toClassId, classIds),
          ),
        );
      await tx.delete(classes).where(inArray(classes.id, classIds));
    }
    // These point at the subject without a cascade. Replies and attachments
    // cascade from their thread; weeks, quizzes, resources and credits from
    // the subject.
    await tx.delete(discussionThreads).where(eq(discussionThreads.subjectId, id));
    await tx.delete(progressTopics).where(eq(progressTopics.subjectId, id));
    await tx.delete(subjects).where(eq(subjects.id, id));

    const rows: (typeof notifications.$inferInsert)[] = [];
    for (const { cls, families } of told) {
      const body = [classDisplayName(subject.name, cls.name), weeklySlotLabel(cls)].join(" · ");
      rows.push({ userId: cls.tutorId, channel: "in_app", title: "Class removed", body, href: "/tutor/timetable" });
      for (const studentId of families.studentIds) {
        rows.push({ userId: studentId, channel: "in_app", title: "Class removed", body, href: "/student/timetable" });
      }
      for (const parentId of families.parentChild.keys()) {
        rows.push({ userId: parentId, channel: "in_app", title: "Class removed", body, href: "/parent" });
      }
    }
    if (rows.length > 0) await tx.insert(notifications).values(rows);
    return { ok: true as const };
  });

  if (result.ok) revalidateSubjects();
  return result;
}
