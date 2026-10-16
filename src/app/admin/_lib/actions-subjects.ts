"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classCredits,
  classes,
  discussionThreads,
  progressTopics,
  quizAttempts,
  quizzes,
  resources,
  subjects,
  subjectTopics,
  subjectWeeks,
} from "@/db/schema";
import { requireAdmin } from "./guard";
import { withActor } from "@/lib/with-actor";
import { SUBJECT_COLORS, defaultSubjectColor } from "@/lib/subject-tone";

const subjectFields = z.object({
  name: z.string().trim().min(1, "Enter a subject name.").max(200),
  yearLevel: z.string().trim().max(40).optional(),
  color: z.enum(SUBJECT_COLORS).optional(),
});

type SubjectResult = { ok: true; id: string } | { ok: false; error: string };

/** Postgres unique_violation on subjects.name (Drizzle may wrap it), as a sentence. */
function duplicateNameError(error: unknown, name: string): string | null {
  const e = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const unique = e?.code === "23505" || e?.cause?.code === "23505";
  return unique ? `A subject named "${name}" already exists.` : null;
}

function revalidateSubjects(id?: string) {
  revalidatePath("/admin/classes");
  if (id) revalidatePath(`/admin/subjects/${id}/curriculum`);
  // Subject names and colours show in every portal.
  revalidatePath("/", "layout");
}

export async function createSubject(
  input: z.input<typeof subjectFields>,
): Promise<SubjectResult> {
  const user = await requireAdmin();
  const parsed = subjectFields.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;
  try {
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
  } catch (error) {
    const duplicate = duplicateNameError(error, data.name);
    if (duplicate) return { ok: false, error: duplicate };
    throw error;
  }
}

const updateSubjectSchema = subjectFields.extend({
  id: z.string().uuid(),
  color: z.enum(SUBJECT_COLORS),
});

export async function updateSubject(
  input: z.input<typeof updateSubjectSchema>,
): Promise<SubjectResult> {
  const user = await requireAdmin();
  const parsed = updateSubjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;
  try {
    const rows = await withActor({ id: user.id, role: "admin" }, (tx) =>
      tx
        .update(subjects)
        .set({ name: data.name, yearLevel: data.yearLevel || null, color: data.color })
        .where(eq(subjects.id, data.id))
        .returning({ id: subjects.id }),
    );
    if (rows.length === 0) return { ok: false, error: "This subject no longer exists." };
    revalidateSubjects(data.id);
    return { ok: true, id: data.id };
  } catch (error) {
    const duplicate = duplicateNameError(error, data.name);
    if (duplicate) return { ok: false, error: duplicate };
    throw error;
  }
}

export type SubjectDeletionImpact = {
  /** Classes still using the subject; it cannot be deleted until none are. */
  classes: { id: string; name: string }[];
  weeks: number;
  topics: number;
  quizzes: number;
  quizAttempts: number;
  resources: number;
  discussionThreads: number;
  /** Make-up credits not yet used or expired. */
  openCredits: number;
  /** Anything beyond the bare subject; the name must be typed to delete. */
  hasContent: boolean;
};

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function subjectDeletionImpact(tx: DbTx, id: string): Promise<SubjectDeletionImpact> {
  const count = sql<number>`count(*)::int`;
  const [classRows, [weeks], [topics], [quizRows], [attempts], [res], [threads], [credits], [progress]] =
    await Promise.all([
      tx
        .select({ id: classes.id, name: classes.name })
        .from(classes)
        .where(eq(classes.subjectId, id))
        .orderBy(asc(classes.name)),
      tx.select({ n: count }).from(subjectWeeks).where(eq(subjectWeeks.subjectId, id)),
      tx.select({ n: count }).from(subjectTopics).where(eq(subjectTopics.subjectId, id)),
      tx.select({ n: count }).from(quizzes).where(eq(quizzes.subjectId, id)),
      tx
        .select({ n: count })
        .from(quizAttempts)
        .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
        .where(eq(quizzes.subjectId, id)),
      tx.select({ n: count }).from(resources).where(eq(resources.subjectId, id)),
      tx.select({ n: count }).from(discussionThreads).where(eq(discussionThreads.subjectId, id)),
      tx
        .select({ n: count })
        .from(classCredits)
        .where(and(eq(classCredits.subjectId, id), eq(classCredits.status, "active"))),
      tx.select({ n: count }).from(progressTopics).where(eq(progressTopics.subjectId, id)),
    ]);
  const impact = {
    classes: classRows,
    weeks: weeks?.n ?? 0,
    topics: topics?.n ?? 0,
    quizzes: quizRows?.n ?? 0,
    quizAttempts: attempts?.n ?? 0,
    resources: res?.n ?? 0,
    discussionThreads: threads?.n ?? 0,
    openCredits: credits?.n ?? 0,
  };
  return {
    ...impact,
    hasContent:
      impact.weeks + impact.topics + impact.quizzes + impact.resources +
        impact.discussionThreads + impact.openCredits + (progress?.n ?? 0) > 0,
  };
}

/** What deleting the subject would remove, for the confirmation dialog. */
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
  confirmName: z.string().max(200).optional(),
});

/**
 * Delete a subject and its curriculum. Refused while any class uses it; with
 * content, the admin must type the subject name (checked here too).
 */
export async function deleteSubject(
  input: z.infer<typeof deleteSubjectSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireAdmin();
  const { id, confirmName } = deleteSubjectSchema.parse(input);

  const result = await withActor({ id: user.id, role: "admin" }, async (tx) => {
    const [subject] = await tx
      .select({ name: subjects.name })
      .from(subjects)
      .where(eq(subjects.id, id))
      .for("update");
    if (!subject) return { ok: false as const, error: "This subject no longer exists." };

    const impact = await subjectDeletionImpact(tx, id);
    if (impact.classes.length > 0) {
      return {
        ok: false as const,
        error: "Delete or move this subject's classes first.",
      };
    }
    if (impact.hasContent && confirmName?.trim() !== subject.name.trim()) {
      return {
        ok: false as const,
        error: "Type the subject name exactly to delete it.",
      };
    }

    // These point at the subject without a cascade. Replies and attachments
    // cascade from their thread.
    await tx.delete(discussionThreads).where(eq(discussionThreads.subjectId, id));
    await tx.delete(progressTopics).where(eq(progressTopics.subjectId, id));
    await tx.delete(subjects).where(eq(subjects.id, id));
    return { ok: true as const };
  });

  if (result.ok) revalidateSubjects();
  return result;
}
