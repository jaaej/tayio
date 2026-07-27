"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  quizzes,
  quizAttachments,
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
import {
  gradeQuizAnswers,
  validateQuizForSubmit,
  type QuizQuestionInput,
} from "@/lib/quiz-validation";
import {
  canStudentAccessApprovedQuiz,
  getQuizWithContent,
} from "@/lib/quiz-queries";
import {
  QUIZ_ATTACHMENT_LIMIT,
  QUIZ_UPLOAD_BATCH_LIMIT,
  removeQuizAttachmentFile,
  uploadQuizAttachmentFile,
} from "@/lib/quiz-storage";

type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };

function revalidate(quizId: string) {
  revalidatePath("/admin/quizzes");
  revalidatePath(`/admin/quizzes/${quizId}`);
  revalidatePath("/tutor/quizzes");
  revalidatePath(`/tutor/quizzes/${quizId}`);
  revalidatePath(`/student/quizzes/${quizId}`);
  revalidatePath("/student/subjects/[id]", "page");
  revalidatePath("/tutor/classes/[id]/curriculum", "page");
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

async function quizAlreadyExists(subjectWeekId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(eq(quizzes.subjectWeekId, subjectWeekId))
    .limit(1);
  return Boolean(row);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
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
): Promise<{
  quizId: string;
  questionId: string;
  type: "multiple_choice" | "true_false" | "context";
} | null> {
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
  if (await quizAlreadyExists(subjectWeekId)) {
    return { ok: false, error: "This subject week already has a quiz." };
  }

  let row: { id: string } | undefined;
  try {
    [row] = await db
      .insert(quizzes)
      .values({
        subjectId: week.subjectId,
        subjectWeekId,
        title,
        status: "draft",
        createdBy: user.id,
      })
      .returning({ id: quizzes.id });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "This subject week already has a quiz." };
    }
    throw error;
  }
  if (!row) return { ok: false, error: "Quiz could not be created." };

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
  if (await quizAlreadyExists(subjectWeekId)) {
    return { ok: false, error: "This subject week already has a quiz." };
  }

  const [tutor] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, tutorId))
    .limit(1);
  if (!tutor || coarseRole(tutor.role) !== "tutor") {
    return { ok: false, error: "Selected user is not a tutor." };
  }

  let row: { id: string } | undefined;
  try {
    [row] = await db
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
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "This subject week already has a quiz." };
    }
    throw error;
  }
  if (!row) return { ok: false, error: "Quiz request could not be created." };

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

export async function updateQuizTitle(input: {
  quizId: string;
  title: string;
}): Promise<Result> {
  const parsed = z
    .object({
      quizId: z.string().uuid(),
      title: z.string().trim().min(1).max(200),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a quiz name between 1 and 200 characters." };
  }

  const editor = await currentEditor();
  const [row] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, parsed.data.quizId))
    .limit(1);
  if (!row) return { ok: false, error: "Quiz not found." };

  if (editor.role === "tutor") {
    const editable = await loadEditable(row.id, editor.id, editor.role);
    if (!editable.ok) return editable;
  }

  await db
    .update(quizzes)
    .set({ title: parsed.data.title, updatedAt: new Date() })
    .where(eq(quizzes.id, row.id));
  revalidate(row.id);
  return { ok: true };
}

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

  const editor = await currentEditor();
  const editable = await loadEditable(quizId, editor.id, editor.role);
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

export async function uploadQuizAttachments(formData: FormData): Promise<Result> {
  const parsed = z
    .object({ quizId: z.string().uuid() })
    .safeParse({ quizId: formData.get("quizId") });
  if (!parsed.success) return { ok: false, error: "Invalid quiz." };
  const { quizId } = parsed.data;

  const editor = await currentEditor();
  const editable = await loadEditable(quizId, editor.id, editor.role);
  if (!editable.ok) return editable;

  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length === 0) return { ok: false, error: "Choose at least one file." };
  if (files.length > QUIZ_UPLOAD_BATCH_LIMIT) {
    return {
      ok: false,
      error: `Upload no more than ${QUIZ_UPLOAD_BATCH_LIMIT} files at once.`,
    };
  }

  const [{ count }] = await db
    .select({
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(quizAttachments)
    .where(eq(quizAttachments.quizId, quizId));
  if (count + files.length > QUIZ_ATTACHMENT_LIMIT) {
    return {
      ok: false,
      error: `A quiz can have up to ${QUIZ_ATTACHMENT_LIMIT} attachments.`,
    };
  }

  const staged: Array<{
    fileName: string;
    storageBucket: string;
    storagePath: string;
    contentType: string;
    sizeBytes: number;
  }> = [];

  for (const file of files) {
    const uploaded = await uploadQuizAttachmentFile(quizId, file);
    if (!uploaded.ok) {
      await Promise.all(
        staged.map((item) =>
          removeQuizAttachmentFile(item.storageBucket, item.storagePath),
        ),
      );
      return { ok: false, error: uploaded.error };
    }
    staged.push({
      fileName: file.name.trim().slice(0, 255) || "Attachment",
      ...uploaded.value,
    });
  }

  try {
    await db.insert(quizAttachments).values(
      staged.map((item) => ({
        quizId,
        uploadedBy: editor.id,
        ...item,
      })),
    );
  } catch {
    await Promise.all(
      staged.map((item) =>
        removeQuizAttachmentFile(item.storageBucket, item.storagePath),
      ),
    );
    return {
      ok: false,
      error: "The attachments could not be saved. Please try again.",
    };
  }

  await touchQuiz(quizId);
  revalidate(quizId);
  return { ok: true };
}

export async function deleteQuizAttachment(input: {
  attachmentId: string;
}): Promise<Result> {
  const parsed = z
    .object({ attachmentId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid attachment." };

  const [attachment] = await db
    .select()
    .from(quizAttachments)
    .where(eq(quizAttachments.id, parsed.data.attachmentId))
    .limit(1);
  if (!attachment) return { ok: false, error: "Attachment not found." };

  const editable = await assertCanEdit(attachment.quizId);
  if (!editable.ok) return editable;

  const removed = await removeQuizAttachmentFile(
    attachment.storageBucket,
    attachment.storagePath,
  );
  if (!removed.ok) {
    return { ok: false, error: `File could not be removed: ${removed.error}` };
  }

  await db
    .delete(quizAttachments)
    .where(eq(quizAttachments.id, attachment.id));
  await touchQuiz(attachment.quizId);
  revalidate(attachment.quizId);
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
  if (row.status !== "draft" && row.status !== "pending_review") {
    return {
      ok: false,
      error: "Only a draft or a quiz pending review can be approved.",
    };
  }

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

export async function gradePracticeQuiz(input: {
  quizId: string;
  answers: Array<{ questionId: string; optionId: string }>;
}): Promise<
  | {
      ok: true;
      grade: {
        correctCount: number;
        total: number;
        results: Array<{
          questionId: string;
          selectedOptionId: string;
          correctOptionId: string;
          isCorrect: boolean;
        }>;
      };
    }
  | { ok: false; error: string }
> {
  const user = await requireRole("student");
  const parsed = z
    .object({
      quizId: z.string().uuid(),
      answers: z
        .array(
          z.object({
            questionId: z.string().uuid(),
            optionId: z.string().uuid(),
          }),
        )
        .max(100),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid quiz answers." };

  if (!(await canStudentAccessApprovedQuiz(user.id, parsed.data.quizId))) {
    return { ok: false, error: "Quiz not found." };
  }

  const questions = await db
    .select({ id: quizQuestions.id })
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, parsed.data.quizId));
  if (questions.length === 0) {
    return { ok: false, error: "This quiz has no questions." };
  }

  const options = await db
    .select({
      id: quizOptions.id,
      questionId: quizOptions.questionId,
      isCorrect: quizOptions.isCorrect,
    })
    .from(quizOptions)
    .where(
      inArray(
        quizOptions.questionId,
        questions.map((question) => question.id),
      ),
    );

  const answerKeys = questions.map((question) => {
    const questionOptions = options.filter(
      (option) => option.questionId === question.id,
    );
    const correct = questionOptions.find((option) => option.isCorrect);
    return {
      questionId: question.id,
      optionIds: questionOptions.map((option) => option.id),
      correctOptionId: correct?.id ?? "",
    };
  });
  if (answerKeys.some((key) => key.correctOptionId.length === 0)) {
    return { ok: false, error: "This quiz is missing a correct answer." };
  }

  const result = gradeQuizAnswers(answerKeys, parsed.data.answers);
  return result.ok ? { ok: true, grade: result.grade } : result;
}
