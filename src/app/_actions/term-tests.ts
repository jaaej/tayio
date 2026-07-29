"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { quizzes, terms, subjects, notifications, profiles } from "@/db/schema";
import { requireAdmin } from "@/app/admin/_lib/guard";
import { coarseRole } from "@/lib/roles";

type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };

function revalidate(quizId: string) {
  revalidatePath("/admin/quizzes");
  revalidatePath(`/admin/quizzes/${quizId}`);
  revalidatePath("/tutor/quizzes");
  revalidatePath(`/tutor/quizzes/${quizId}`);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

async function termTestAlreadyExists(
  subjectId: string,
  termId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(
      and(
        eq(quizzes.subjectId, subjectId),
        eq(quizzes.termId, termId),
        eq(quizzes.kind, "term_test"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function createTermTest(input: {
  subjectId: string;
  termId: string;
  title: string;
  tutorId?: string;
  note?: string;
}): Promise<CreateResult> {
  const user = await requireAdmin();
  const parsed = z
    .object({
      subjectId: z.string().uuid(),
      termId: z.string().uuid(),
      title: z.string().trim().min(1).max(200),
      tutorId: z.string().uuid().optional(),
      note: z.string().trim().max(5000).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { subjectId, termId, title, tutorId, note } = parsed.data;

  const [subject] = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(eq(subjects.id, subjectId))
    .limit(1);
  if (!subject) return { ok: false, error: "Subject not found." };

  const [term] = await db
    .select({ endDate: terms.endDate })
    .from(terms)
    .where(eq(terms.id, termId))
    .limit(1);
  if (!term) return { ok: false, error: "Term not found." };

  if (await termTestAlreadyExists(subjectId, termId)) {
    return { ok: false, error: "This subject already has a term test for this term." };
  }

  if (tutorId) {
    const [tutor] = await db
      .select({ role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, tutorId))
      .limit(1);
    if (!tutor || coarseRole(tutor.role) !== "tutor") {
      return { ok: false, error: "Selected user is not a tutor." };
    }
  }

  // Results release defaults to the end of the term's last day (local time),
  // editable later via setTermTestReleaseDate.
  const resultsReleaseAt = new Date(`${term.endDate}T23:59:59.999`);

  let row: { id: string } | undefined;
  try {
    [row] = await db
      .insert(quizzes)
      .values({
        subjectId,
        kind: "term_test",
        subjectWeekId: null,
        termId,
        resultsReleaseAt,
        title,
        status: tutorId ? "requested" : "draft",
        createdBy: user.id,
        assignedTutorId: tutorId ?? null,
        note: note && note.length > 0 ? note : null,
      })
      .returning({ id: quizzes.id });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "This subject already has a term test for this term." };
    }
    throw error;
  }
  if (!row) return { ok: false, error: "Term test could not be created." };

  if (tutorId) {
    await db.insert(notifications).values({
      userId: tutorId,
      channel: "in_app" as const,
      title: "Quiz requested",
      body: `Please build the "${title}" quiz`,
      href: `/tutor/quizzes/${row.id}`,
    });
  }

  revalidate(row.id);
  return { ok: true, id: row.id };
}

export async function setTermTestReleaseDate(input: {
  quizId: string;
  releaseAt: Date;
}): Promise<Result> {
  await requireAdmin();
  const parsed = z
    .object({
      quizId: z.string().uuid(),
      releaseAt: z.date(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { quizId, releaseAt } = parsed.data;

  const [row] = await db
    .select({ kind: quizzes.kind, resultsReleaseAt: quizzes.resultsReleaseAt })
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);
  if (!row) return { ok: false, error: "Term test not found." };
  if (row.kind !== "term_test") {
    return { ok: false, error: "Only term tests have a release date." };
  }
  if (!row.resultsReleaseAt || row.resultsReleaseAt <= new Date()) {
    return { ok: false, error: "Results have already been released." };
  }

  await db
    .update(quizzes)
    .set({ resultsReleaseAt: releaseAt, updatedAt: new Date() })
    .where(eq(quizzes.id, quizId));

  revalidate(quizId);
  return { ok: true };
}
