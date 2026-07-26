import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  quizzes,
  quizQuestions,
  quizOptions,
  subjects,
  subjectWeeks,
  profiles,
  quizStatusEnum,
} from "@/db/schema";

export type QuizListRow = {
  id: string;
  title: string;
  status: string;
  subjectName: string;
  weekNumber: number;
  assignedTutorName: string | null;
  updatedAt: Date;
};

export type QuizWithContent = {
  quiz: {
    id: string;
    title: string;
    status: string;
    subjectId: string;
    subjectName: string;
    subjectWeekId: string;
    weekNumber: number;
    assignedTutorId: string | null;
    note: string | null;
    createdBy: string;
  };
  questions: Array<{
    id: string;
    prompt: string;
    type: string;
    position: number;
    options: Array<{ id: string; text: string; isCorrect: boolean; position: number }>;
  }>;
};

function baseListSelect() {
  const tutor = alias(profiles, "assigned_tutor");
  return db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      status: quizzes.status,
      subjectName: subjects.name,
      weekNumber: subjectWeeks.weekNumber,
      assignedTutorFirst: tutor.firstName,
      assignedTutorLast: tutor.lastName,
      updatedAt: quizzes.updatedAt,
    })
    .from(quizzes)
    .innerJoin(subjects, eq(subjects.id, quizzes.subjectId))
    .innerJoin(subjectWeeks, eq(subjectWeeks.id, quizzes.subjectWeekId))
    .leftJoin(tutor, eq(tutor.id, quizzes.assignedTutorId));
}

function toListRow(r: {
  id: string; title: string; status: string; subjectName: string;
  weekNumber: number; assignedTutorFirst: string | null;
  assignedTutorLast: string | null; updatedAt: Date;
}): QuizListRow {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    subjectName: r.subjectName,
    weekNumber: r.weekNumber,
    assignedTutorName:
      r.assignedTutorFirst != null
        ? `${r.assignedTutorFirst} ${r.assignedTutorLast ?? ""}`.trim()
        : null,
    updatedAt: r.updatedAt,
  };
}

export async function listQuizzesForAdmin(filter?: {
  status?: (typeof quizStatusEnum.enumValues)[number];
}): Promise<QuizListRow[]> {
  const rows = await baseListSelect()
    .where(filter?.status ? eq(quizzes.status, filter.status) : undefined)
    .orderBy(desc(quizzes.updatedAt));
  return rows.map(toListRow);
}

export async function listQuizzesForTutor(tutorId: string): Promise<QuizListRow[]> {
  const rows = await baseListSelect()
    .where(eq(quizzes.assignedTutorId, tutorId))
    .orderBy(desc(quizzes.updatedAt));
  return rows.map(toListRow);
}

export async function getQuizWithContent(
  quizId: string,
): Promise<QuizWithContent | null> {
  const rows = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      status: quizzes.status,
      subjectId: quizzes.subjectId,
      subjectName: subjects.name,
      subjectWeekId: quizzes.subjectWeekId,
      weekNumber: subjectWeeks.weekNumber,
      assignedTutorId: quizzes.assignedTutorId,
      note: quizzes.note,
      createdBy: quizzes.createdBy,
    })
    .from(quizzes)
    .innerJoin(subjects, eq(subjects.id, quizzes.subjectId))
    .innerJoin(subjectWeeks, eq(subjectWeeks.id, quizzes.subjectWeekId))
    .where(eq(quizzes.id, quizId))
    .limit(1);
  const quiz = rows[0];
  if (!quiz) return null;

  const qs = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(asc(quizQuestions.position));

  const questionIds = qs.map((q) => q.id);
  const opts = questionIds.length
    ? await db
        .select()
        .from(quizOptions)
        .where(inArray(quizOptions.questionId, questionIds))
        .orderBy(asc(quizOptions.position))
    : [];

  return {
    quiz,
    questions: qs.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      position: q.position,
      options: opts
        .filter((o) => o.questionId === q.id)
        .map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, position: o.position })),
    })),
  };
}
