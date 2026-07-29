import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  quizzes,
  quizAttachments,
  quizQuestions,
  quizOptions,
  subjects,
  subjectWeeks,
  terms,
  profiles,
  quizStatusEnum,
} from "@/db/schema";
import { signQuizAttachment } from "@/lib/quiz-storage";
import { formatQuizWeekLabel } from "@/lib/quiz-status";

export type QuizListRow = {
  id: string;
  title: string;
  status: string;
  subjectName: string;
  termYear: number;
  termNumber: number;
  weekNumber: number;
  assignedTutorId: string | null;
  assignedTutorName: string | null;
  updatedAt: Date;
};

export type QuizAttachmentView = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  questionId: string | null;
  url: string | null;
};

export type QuizWithContent = {
  quiz: {
    id: string;
    title: string;
    status: string;
    subjectId: string;
    subjectName: string;
    subjectWeekId: string;
    termId: string;
    termYear: number;
    termNumber: number;
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
    parentId: string | null;
    options: Array<{ id: string; text: string; isCorrect: boolean; position: number }>;
  }>;
  attachments: QuizAttachmentView[];
};

function baseListSelect() {
  const tutor = alias(profiles, "assigned_tutor");
  return db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      status: quizzes.status,
      subjectName: subjects.name,
      termYear: terms.year,
      termNumber: terms.termNumber,
      weekNumber: subjectWeeks.weekNumber,
      assignedTutorId: quizzes.assignedTutorId,
      assignedTutorFirst: tutor.firstName,
      assignedTutorLast: tutor.lastName,
      updatedAt: quizzes.updatedAt,
    })
    .from(quizzes)
    .innerJoin(subjects, eq(subjects.id, quizzes.subjectId))
    .innerJoin(subjectWeeks, eq(subjectWeeks.id, quizzes.subjectWeekId))
    .innerJoin(terms, eq(terms.id, subjectWeeks.termId))
    .leftJoin(tutor, eq(tutor.id, quizzes.assignedTutorId));
}

function toListRow(r: {
  id: string; title: string; status: string; subjectName: string;
  termYear: number; termNumber: number; weekNumber: number;
  assignedTutorId: string | null; assignedTutorFirst: string | null;
  assignedTutorLast: string | null; updatedAt: Date;
}): QuizListRow {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    subjectName: r.subjectName,
    termYear: r.termYear,
    termNumber: r.termNumber,
    weekNumber: r.weekNumber,
    assignedTutorId: r.assignedTutorId,
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
  const taughtSubjects = await db
    .selectDistinct({ subjectId: classes.subjectId })
    .from(classes)
    .where(eq(classes.tutorId, tutorId));
  const taughtSubjectIds = taughtSubjects.map((row) => row.subjectId);
  const visible =
    taughtSubjectIds.length > 0
      ? or(
          eq(quizzes.assignedTutorId, tutorId),
          and(
            eq(quizzes.status, "approved"),
            inArray(quizzes.subjectId, taughtSubjectIds),
          ),
        )
      : eq(quizzes.assignedTutorId, tutorId);

  const rows = await baseListSelect()
    .where(visible)
    .orderBy(desc(quizzes.updatedAt));
  return rows.map(toListRow);
}

export async function listQuizTargets(): Promise<{
  tutors: { id: string; name: string }[];
  weeks: { id: string; label: string }[];
}> {
  const tutorRows = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(profiles)
    .where(and(eq(profiles.role, "tutor"), eq(profiles.isActive, true)))
    .orderBy(asc(profiles.firstName));

  const weekRows = await db
    .select({
      id: subjectWeeks.id,
      weekNumber: subjectWeeks.weekNumber,
      subjectName: subjects.name,
      year: terms.year,
      termNumber: terms.termNumber,
    })
    .from(subjectWeeks)
    .innerJoin(subjects, eq(subjects.id, subjectWeeks.subjectId))
    .innerJoin(terms, eq(terms.id, subjectWeeks.termId))
    .leftJoin(quizzes, eq(quizzes.subjectWeekId, subjectWeeks.id))
    .where(isNull(quizzes.id))
    .orderBy(
      desc(terms.year),
      desc(terms.termNumber),
      asc(subjects.name),
      asc(subjectWeeks.weekNumber),
    );

  return {
    tutors: tutorRows.map((t) => ({
      id: t.id,
      name: `${t.firstName} ${t.lastName ?? ""}`.trim(),
    })),
    weeks: weekRows.map((w) => ({
      id: w.id,
      label: formatQuizWeekLabel(w),
    })),
  };
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
      // subjectWeekId is nullable at the column level (term tests have no
      // week), but this query inner-joins subjectWeeks so every returned row
      // is weekly and has a non-null value; cast to match QuizWithContent.
      subjectWeekId: sql<string>`${quizzes.subjectWeekId}`,
      termId: terms.id,
      termYear: terms.year,
      termNumber: terms.termNumber,
      weekNumber: subjectWeeks.weekNumber,
      assignedTutorId: quizzes.assignedTutorId,
      note: quizzes.note,
      createdBy: quizzes.createdBy,
    })
    .from(quizzes)
    .innerJoin(subjects, eq(subjects.id, quizzes.subjectId))
    .innerJoin(subjectWeeks, eq(subjectWeeks.id, quizzes.subjectWeekId))
    .innerJoin(terms, eq(terms.id, subjectWeeks.termId))
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
  const attachmentRows = await db
    .select()
    .from(quizAttachments)
    .where(eq(quizAttachments.quizId, quizId))
    .orderBy(asc(quizAttachments.createdAt));
  const attachments = await Promise.all(
    attachmentRows.map(async (attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      questionId: attachment.questionId,
      url: await signQuizAttachment(
        attachment.storageBucket,
        attachment.storagePath,
      ),
    })),
  );

  return {
    quiz,
    questions: qs.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      position: q.position,
      parentId: q.parentId,
      options: opts
        .filter((o) => o.questionId === q.id)
        .map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, position: o.position })),
    })),
    attachments,
  };
}

export type ApprovedQuizSummary = {
  id: string;
  title: string;
  subjectWeekId: string;
  questionCount: number;
};

export async function listApprovedQuizSummariesForWeeks(
  weekIds: string[],
): Promise<ApprovedQuizSummary[]> {
  if (weekIds.length === 0) return [];
  return db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      // Filtered by inArray(quizzes.subjectWeekId, weekIds) below, so every
      // returned row has a non-null value; cast to match ApprovedQuizSummary.
      subjectWeekId: sql<string>`${quizzes.subjectWeekId}`,
      questionCount: sql<number>`count(${quizQuestions.id})`.mapWith(Number),
    })
    .from(quizzes)
    .leftJoin(
      quizQuestions,
      and(
        eq(quizQuestions.quizId, quizzes.id),
        sql`${quizQuestions.type} <> 'context'`,
      ),
    )
    .where(
      and(
        eq(quizzes.status, "approved"),
        inArray(quizzes.subjectWeekId, weekIds),
      ),
    )
    .groupBy(quizzes.id, quizzes.title, quizzes.subjectWeekId);
}

export async function canTutorViewQuiz(
  tutorId: string,
  quiz: Pick<
    QuizWithContent["quiz"],
    "assignedTutorId" | "status" | "subjectId"
  >,
): Promise<boolean> {
  if (quiz.assignedTutorId === tutorId) return true;
  if (quiz.status !== "approved") return false;
  const [taught] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(
      and(
        eq(classes.tutorId, tutorId),
        eq(classes.subjectId, quiz.subjectId),
      ),
    )
    .limit(1);
  return Boolean(taught);
}

export async function canStudentAccessApprovedQuiz(
  studentId: string,
  quizId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .innerJoin(classes, eq(classes.subjectId, quizzes.subjectId))
    .innerJoin(
      enrollments,
      and(
        eq(enrollments.classId, classes.id),
        eq(enrollments.studentId, studentId),
        isNull(enrollments.withdrawnAt),
      ),
    )
    .where(and(eq(quizzes.id, quizId), eq(quizzes.status, "approved")))
    .limit(1);
  return Boolean(row);
}

export type StudentQuiz = {
  quiz: {
    id: string;
    title: string;
    subjectId: string;
    subjectName: string;
    subjectWeekId: string;
    termId: string;
    termYear: number;
    termNumber: number;
    weekNumber: number;
  };
  questions: Array<{
    id: string;
    prompt: string;
    type: string;
    position: number;
    parentId: string | null;
    options: Array<{ id: string; text: string; position: number }>;
  }>;
  attachments: QuizAttachmentView[];
};

/**
 * Student delivery deliberately omits quiz_options.is_correct.
 * The enrolment check runs before questions or options are loaded.
 */
export async function getStudentQuiz(
  studentId: string,
  quizId: string,
): Promise<StudentQuiz | null> {
  if (!(await canStudentAccessApprovedQuiz(studentId, quizId))) return null;

  const [quiz] = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      subjectId: quizzes.subjectId,
      subjectName: subjects.name,
      // subjectWeekId is nullable at the column level (term tests have no
      // week), but this query inner-joins subjectWeeks so every returned row
      // is weekly and has a non-null value; cast to match StudentQuiz.
      subjectWeekId: sql<string>`${quizzes.subjectWeekId}`,
      termId: terms.id,
      termYear: terms.year,
      termNumber: terms.termNumber,
      weekNumber: subjectWeeks.weekNumber,
    })
    .from(quizzes)
    .innerJoin(subjects, eq(subjects.id, quizzes.subjectId))
    .innerJoin(subjectWeeks, eq(subjectWeeks.id, quizzes.subjectWeekId))
    .innerJoin(terms, eq(terms.id, subjectWeeks.termId))
    .where(and(eq(quizzes.id, quizId), eq(quizzes.status, "approved")))
    .limit(1);
  if (!quiz) return null;

  const questions = await db
    .select({
      id: quizQuestions.id,
      prompt: quizQuestions.prompt,
      type: quizQuestions.type,
      position: quizQuestions.position,
      parentId: quizQuestions.parentId,
    })
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(asc(quizQuestions.position));
  const questionIds = questions.map((question) => question.id);
  const options = questionIds.length
    ? await db
        .select({
          id: quizOptions.id,
          questionId: quizOptions.questionId,
          text: quizOptions.text,
          position: quizOptions.position,
        })
        .from(quizOptions)
        .where(inArray(quizOptions.questionId, questionIds))
        .orderBy(asc(quizOptions.position))
    : [];

  const attachmentRows = await db
    .select()
    .from(quizAttachments)
    .where(eq(quizAttachments.quizId, quizId))
    .orderBy(asc(quizAttachments.createdAt));
  const attachments = await Promise.all(
    attachmentRows.map(async (attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      questionId: attachment.questionId,
      url: await signQuizAttachment(
        attachment.storageBucket,
        attachment.storagePath,
      ),
    })),
  );

  return {
    quiz,
    questions: questions.map((question) => ({
      ...question,
      options: options
        .filter((option) => option.questionId === question.id)
        .map(({ id, text, position }) => ({ id, text, position })),
    })),
    attachments,
  };
}
