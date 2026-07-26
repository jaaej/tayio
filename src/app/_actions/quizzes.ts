"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  quizzes,
  quizQuestions,
  quizOptions,
  notifications,
  subjectWeeks,
  profiles,
  type UserRole,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { requireAdmin } from "@/app/admin/_lib/guard";
import { coarseRole } from "@/lib/roles";
import { validateQuizForSubmit, type QuizQuestionInput } from "@/lib/quiz-validation";
import { getQuizWithContent } from "@/lib/quiz-queries";

type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };

function revalidate(quizId: string) {
  revalidatePath("/admin/quizzes");
  revalidatePath(`/admin/quizzes/${quizId}`);
  revalidatePath("/tutor/quizzes");
  revalidatePath(`/tutor/quizzes/${quizId}`);
}

type EditRole = "admin" | "tutor";

/** Any staff member who might edit a quiz (admin or tutor); per-action checks follow. */
async function currentEditor(): Promise<{ id: string; role: EditRole }> {
  const user = await requireRole(["admin", "tutor"]);
  const role = coarseRole(user.app_metadata?.role as UserRole);
  return { id: user.id, role: role as EditRole };
}

/** Load a quiz row and assert the caller may edit it. */
async function loadEditable(
  quizId: string,
  userId: string,
  role: EditRole,
): Promise<{ ok: true; row: typeof quizzes.$inferSelect } | { ok: false; error: string }> {
  const [row] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (!row) return { ok: false, error: "Quiz not found." };
  if (role === "admin") {
    if (row.status === "approved") return { ok: false, error: "Quiz is approved and locked." };
    return { ok: true, row };
  }
  // tutor
  if (row.assignedTutorId !== userId) {
    return { ok: false, error: "This quiz is not assigned to you." };
  }
  if (row.status !== "requested" && row.status !== "changes_requested") {
    return { ok: false, error: "This quiz can no longer be edited." };
  }
  return { ok: true, row };
}

async function assertCanEdit(
  quizId: string,
): Promise<{ ok: true; row: typeof quizzes.$inferSelect } | { ok: false; error: string }> {
  const editor = await currentEditor();
  return loadEditable(quizId, editor.id, editor.role);
}

async function touchQuiz(quizId: string) {
  await db.update(quizzes).set({ updatedAt: new Date() }).where(eq(quizzes.id, quizId));
}

async function quizIdForQuestion(questionId: string): Promise<string | null> {
  const [row] = await db
    .select({ quizId: quizQuestions.quizId })
    .from(quizQuestions)
    .where(eq(quizQuestions.id, questionId))
    .limit(1);
  return row?.quizId ?? null;
}

async function quizIdAndTypeForOption(
  optionId: string,
): Promise<{ quizId: string; questionId: string; type: "multiple_choice" | "true_false" } | null> {
  const [row] = await db
    .select({
      quizId: quizQuestions.quizId,
      questionId: quizOptions.questionId,
      type: quizQuestions.type,
    })
    .from(quizOptions)
    .innerJoin(quizQuestions, eq(quizQuestions.id, quizOptions.questionId))
    .where(eq(quizOptions.id, optionId))
    .limit(1);
  return row ?? null;
}

// --- Admin lifecycle ---------------------------------------------------

export async function createQuizDirect(input: {
  subjectWeekId: string;
  title: string;
}): Promise<CreateResult> {
  const user = await requireAdmin();
  const parsed = z
    .object({
      subjectWeekId: z.string().uuid(),
      title: z.string().trim().min(1).max(200),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { subjectWeekId, title } = parsed.data;

  const [week] = await db
    .select({ subjectId: subjectWeeks.subjectId })
    .from(subjectWeeks)
    .where(eq(subjectWeeks.id, subjectWeekId))
    .limit(1);
  if (!week) return { ok: false, error: "Subject week not found." };

  const [row] = await db
    .insert(quizzes)
    .values({
      subjectId: week.subjectId,
      subjectWeekId,
      title,
      status: "draft",
      createdBy: user.id,
    })
    .returning({ id: quizzes.id });

  revalidate(row.id);
  return { ok: true, id: row.id };
}

export async function requestQuiz(input: {
  subjectWeekId: string;
  title: string;
  tutorId: string;
  note?: string;
}): Promise<CreateResult> {
  const user = await requireAdmin();
  const parsed = z
    .object({
      subjectWeekId: z.string().uuid(),
      title: z.string().trim().min(1).max(200),
      tutorId: z.string().uuid(),
      note: z.string().trim().max(5000).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { subjectWeekId, title, tutorId, note } = parsed.data;

  const [week] = await db
    .select({ subjectId: subjectWeeks.subjectId })
    .from(subjectWeeks)
    .where(eq(subjectWeeks.id, subjectWeekId))
    .limit(1);
  if (!week) return { ok: false, error: "Subject week not found." };

  const [tutor] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, tutorId))
    .limit(1);
  if (!tutor || coarseRole(tutor.role) !== "tutor") {
    return { ok: false, error: "Selected user is not a tutor." };
  }

  const [row] = await db
    .insert(quizzes)
    .values({
      subjectId: week.subjectId,
      subjectWeekId,
      title,
      status: "requested",
      createdBy: user.id,
      assignedTutorId: tutorId,
      note: note && note.length > 0 ? note : null,
    })
    .returning({ id: quizzes.id });

  await db.insert(notifications).values({
    userId: tutorId,
    channel: "in_app" as const,
    title: "Quiz requested",
    body: `Please build the "${title}" quiz`,
    href: `/tutor/quizzes/${row.id}`,
  });

  revalidate(row.id);
  return { ok: true, id: row.id };
}

// --- Shared editing (admin or assigned tutor) ---------------------------

export async function addQuestion(input: {
  quizId: string;
  type: "multiple_choice" | "true_false";
}): Promise<Result> {
  const parsed = z
    .object({
      quizId: z.string().uuid(),
      type: z.enum(["multiple_choice", "true_false"]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { quizId, type } = parsed.data;

  const editable = await assertCanEdit(quizId);
  if (!editable.ok) return editable;

  const [{ nextPosition }] = await db
    .select({
      nextPosition: sql<number>`coalesce(max(${quizQuestions.position}), 0) + 1`.mapWith(Number),
    })
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId));

  const [question] = await db
    .insert(quizQuestions)
    .values({ quizId, prompt: "", type, position: nextPosition })
    .returning({ id: quizQuestions.id });

  if (type === "true_false") {
    await db.insert(quizOptions).values([
      { questionId: question.id, text: "True", isCorrect: true, position: 0 },
      { questionId: question.id, text: "False", isCorrect: false, position: 1 },
    ]);
  }

  await touchQuiz(quizId);
  revalidate(quizId);
  return { ok: true };
}

export async function updateQuestionPrompt(input: {
  questionId: string;
  prompt: string;
}): Promise<Result> {
  const parsed = z
    .object({ questionId: z.string().uuid(), prompt: z.string().trim().max(500) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { questionId, prompt } = parsed.data;

  const quizId = await quizIdForQuestion(questionId);
  if (!quizId) return { ok: false, error: "Question not found." };
  const editable = await assertCanEdit(quizId);
  if (!editable.ok) return editable;

  await db.update(quizQuestions).set({ prompt }).where(eq(quizQuestions.id, questionId));
  await touchQuiz(quizId);
  revalidate(quizId);
  return { ok: true };
}

export async function deleteQuestion(input: { questionId: string }): Promise<Result> {
  const parsed = z.object({ questionId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { questionId } = parsed.data;

  const quizId = await quizIdForQuestion(questionId);
  if (!quizId) return { ok: false, error: "Question not found." };
  const editable = await assertCanEdit(quizId);
  if (!editable.ok) return editable;

  await db.delete(quizQuestions).where(eq(quizQuestions.id, questionId));
  await touchQuiz(quizId);
  revalidate(quizId);
  return { ok: true };
}

export async function addOption(input: { questionId: string }): Promise<Result> {
  const parsed = z.object({ questionId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { questionId } = parsed.data;

  const quizId = await quizIdForQuestion(questionId);
  if (!quizId) return { ok: false, error: "Question not found." };
  const editable = await assertCanEdit(quizId);
  if (!editable.ok) return editable;

  const [question] = await db
    .select({ type: quizQuestions.type })
    .from(quizQuestions)
    .where(eq(quizQuestions.id, questionId))
    .limit(1);
  if (question?.type === "true_false") {
    return { ok: false, error: "True/false questions can't have extra options." };
  }

  const [{ nextPosition }] = await db
    .select({
      nextPosition: sql<number>`coalesce(max(${quizOptions.position}), 0) + 1`.mapWith(Number),
    })
    .from(quizOptions)
    .where(eq(quizOptions.questionId, questionId));

  await db
    .insert(quizOptions)
    .values({ questionId, text: "", isCorrect: false, position: nextPosition });

  await touchQuiz(quizId);
  revalidate(quizId);
  return { ok: true };
}

export async function updateOption(input: { optionId: string; text: string }): Promise<Result> {
  const parsed = z
    .object({ optionId: z.string().uuid(), text: z.string().trim().max(500) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { optionId, text } = parsed.data;

  const found = await quizIdAndTypeForOption(optionId);
  if (!found) return { ok: false, error: "Option not found." };
  const editable = await assertCanEdit(found.quizId);
  if (!editable.ok) return editable;

  await db.update(quizOptions).set({ text }).where(eq(quizOptions.id, optionId));
  await touchQuiz(found.quizId);
  revalidate(found.quizId);
  return { ok: true };
}

export async function deleteOption(input: { optionId: string }): Promise<Result> {
  const parsed = z.object({ optionId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { optionId } = parsed.data;

  const found = await quizIdAndTypeForOption(optionId);
  if (!found) return { ok: false, error: "Option not found." };
  if (found.type === "true_false") {
    return { ok: false, error: "True/false questions can't have options removed." };
  }
  const editable = await assertCanEdit(found.quizId);
  if (!editable.ok) return editable;

  await db.delete(quizOptions).where(eq(quizOptions.id, optionId));
  await touchQuiz(found.quizId);
  revalidate(found.quizId);
  return { ok: true };
}

export async function setCorrectOption(input: {
  questionId: string;
  optionId: string;
}): Promise<Result> {
  const parsed = z
    .object({ questionId: z.string().uuid(), optionId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { questionId, optionId } = parsed.data;

  const quizId = await quizIdForQuestion(questionId);
  if (!quizId) return { ok: false, error: "Question not found." };
  const editable = await assertCanEdit(quizId);
  if (!editable.ok) return editable;

  const [option] = await db
    .select({ id: quizOptions.id })
    .from(quizOptions)
    .where(and(eq(quizOptions.id, optionId), eq(quizOptions.questionId, questionId)))
    .limit(1);
  if (!option) return { ok: false, error: "Option not found on this question." };

  // Exactly one correct option per question: clear all, then set the chosen one.
  await db.transaction(async (tx) => {
    await tx
      .update(quizOptions)
      .set({ isCorrect: false })
      .where(eq(quizOptions.questionId, questionId));
    await tx.update(quizOptions).set({ isCorrect: true }).where(eq(quizOptions.id, optionId));
  });

  await touchQuiz(quizId);
  revalidate(quizId);
  return { ok: true };
}

// --- Submission / review lifecycle --------------------------------------

function toValidationInput(
  content: NonNullable<Awaited<ReturnType<typeof getQuizWithContent>>>,
): QuizQuestionInput[] {
  return content.questions.map((q) => ({
    type: q.type as "multiple_choice" | "true_false",
    prompt: q.prompt,
    options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
  }));
}

export async function submitQuiz(input: { quizId: string }): Promise<Result> {
  const parsed = z.object({ quizId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { quizId } = parsed.data;

  const editor = await currentEditor();
  if (editor.role !== "tutor") {
    return { ok: false, error: "Only the assigned tutor can submit a quiz for review." };
  }
  const editable = await loadEditable(quizId, editor.id, editor.role);
  if (!editable.ok) return editable;

  const content = await getQuizWithContent(quizId);
  if (!content) return { ok: false, error: "Quiz not found." };

  const problems = validateQuizForSubmit(content.quiz.title, toValidationInput(content));
  if (problems.length > 0) return { ok: false, error: problems.join(" ") };

  await db
    .update(quizzes)
    .set({ status: "pending_review", updatedAt: new Date() })
    .where(eq(quizzes.id, quizId));

  await db.insert(notifications).values({
    userId: content.quiz.createdBy,
    channel: "in_app" as const,
    title: "Quiz ready for review",
    body: `"${content.quiz.title}" is ready for review.`,
    href: `/admin/quizzes/${quizId}`,
  });

  revalidate(quizId);
  return { ok: true };
}

export async function approveQuiz(input: { quizId: string }): Promise<Result> {
  const user = await requireAdmin();
  const parsed = z.object({ quizId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { quizId } = parsed.data;

  const [row] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (!row) return { ok: false, error: "Quiz not found." };
  if (row.status === "approved") return { ok: false, error: "Quiz is already approved." };

  const content = await getQuizWithContent(quizId);
  if (!content) return { ok: false, error: "Quiz not found." };
  const problems = validateQuizForSubmit(content.quiz.title, toValidationInput(content));
  if (problems.length > 0) return { ok: false, error: problems.join(" ") };

  await db
    .update(quizzes)
    .set({
      status: "approved",
      approvedBy: user.id,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(quizzes.id, quizId));

  if (row.assignedTutorId) {
    await db.insert(notifications).values({
      userId: row.assignedTutorId,
      channel: "in_app" as const,
      title: "Quiz approved",
      body: `"${row.title}" has been approved.`,
      href: `/tutor/quizzes/${quizId}`,
    });
  }

  revalidate(quizId);
  return { ok: true };
}

export async function requestChanges(input: { quizId: string; note: string }): Promise<Result> {
  await requireAdmin();
  const parsed = z
    .object({ quizId: z.string().uuid(), note: z.string().trim().min(1).max(5000) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { quizId, note } = parsed.data;

  const [row] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (!row) return { ok: false, error: "Quiz not found." };
  if (row.status !== "pending_review") {
    return { ok: false, error: "Only quizzes pending review can be sent back for changes." };
  }

  await db
    .update(quizzes)
    .set({ status: "changes_requested", note, updatedAt: new Date() })
    .where(eq(quizzes.id, quizId));

  if (row.assignedTutorId) {
    await db.insert(notifications).values({
      userId: row.assignedTutorId,
      channel: "in_app" as const,
      title: "Changes requested",
      body: note,
      href: `/tutor/quizzes/${quizId}`,
    });
  }

  revalidate(quizId);
  return { ok: true };
}
