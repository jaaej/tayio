import "server-only";
import { and, asc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  familyLinks,
  profiles,
  quizOptions,
  quizQuestions,
  quizzes,
  termTestAnswers,
  termTestAttempts,
} from "@/db/schema";
import {
  rankTermTestBoard,
  type AttemptScore,
  type BoardRow,
  type CohortMember,
} from "@/lib/term-test";

export type TermTestCorrection = {
  questionId: string;
  prompt: string;
  selectedOptionText: string | null;
  correctOptionText: string;
  /**
   * Authoritative right/wrong flag, computed by option id (not by comparing
   * `selectedOptionText`/`correctOptionText` - two options on the same
   * question can share identical text, which would make a text comparison
   * misclassify a wrong answer as correct or vice versa).
   */
  isCorrect: boolean;
};

export type TermTestBoard = { top: BoardRow[]; me: BoardRow | null };

export type TermTestResults =
  | { released: false; quizId: string; title: string; resultsReleaseAt: Date }
  | {
      released: true;
      quizId: string;
      title: string;
      score: number;
      total: number;
      board: TermTestBoard;
      corrections: TermTestCorrection[];
    };

/**
 * Students with an enrollment in a class of `subjectId`, active at the
 * results deadline: enrolled on/before the deadline and not withdrawn before
 * it. `classes` has no term_id - the term only supplies the release date -
 * so "active at the deadline" is the sole membership test. Distinct by
 * student (a student can have multiple classes in the same subject).
 */
export async function getTermTestCohort(
  subjectId: string,
  releaseAt: Date,
): Promise<CohortMember[]> {
  const rows = await db
    .selectDistinct({
      studentId: enrollments.studentId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(profiles, eq(profiles.id, enrollments.studentId))
    .where(
      and(
        eq(classes.subjectId, subjectId),
        lte(enrollments.enrolledAt, releaseAt),
        or(isNull(enrollments.withdrawnAt), gt(enrollments.withdrawnAt, releaseAt)),
      ),
    );
  return rows.map((r) => ({ studentId: r.studentId, firstName: r.firstName, lastName: r.lastName }));
}

type ApprovedTermTest = {
  id: string;
  title: string;
  subjectId: string;
  resultsReleaseAt: Date;
};

// Loads a term test only if it is the right kind, approved, and has a
// release date set. Anything else (wrong kind, not approved, draft with no
// release date yet) is treated as "no such term test" by the callers.
async function loadApprovedTermTest(quizId: string): Promise<ApprovedTermTest | null> {
  const [quiz] = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      subjectId: quizzes.subjectId,
      kind: quizzes.kind,
      status: quizzes.status,
      resultsReleaseAt: quizzes.resultsReleaseAt,
    })
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);
  if (!quiz || quiz.kind !== "term_test" || quiz.status !== "approved" || !quiz.resultsReleaseAt) {
    return null;
  }
  return {
    id: quiz.id,
    title: quiz.title,
    subjectId: quiz.subjectId,
    resultsReleaseAt: quiz.resultsReleaseAt,
  };
}

// Builds the corrections view (prompt, selected text or null, correct text)
// for every gradable (non-`context`) question, plus this student's score and
// total. A student with no attempt at all gets every question with no
// selection and a score of 0 - the same "no-show" treatment rankTermTestBoard
// gives them on the board.
async function buildCorrectionsAndScore(
  quizId: string,
  studentId: string,
): Promise<{ score: number; total: number; corrections: TermTestCorrection[] }> {
  const questions = await db
    .select({ id: quizQuestions.id, prompt: quizQuestions.prompt })
    .from(quizQuestions)
    .where(and(eq(quizQuestions.quizId, quizId), sql`${quizQuestions.type} <> 'context'`))
    .orderBy(asc(quizQuestions.position));

  const questionIds = questions.map((q) => q.id);
  const options = questionIds.length
    ? await db
        .select({
          id: quizOptions.id,
          questionId: quizOptions.questionId,
          text: quizOptions.text,
          isCorrect: quizOptions.isCorrect,
        })
        .from(quizOptions)
        .where(inArray(quizOptions.questionId, questionIds))
    : [];

  const [attempt] = await db
    .select({ id: termTestAttempts.id, score: termTestAttempts.score, total: termTestAttempts.total })
    .from(termTestAttempts)
    .where(and(eq(termTestAttempts.quizId, quizId), eq(termTestAttempts.studentId, studentId)))
    .limit(1);

  const answers = attempt
    ? await db
        .select({ questionId: termTestAnswers.questionId, selectedOptionId: termTestAnswers.selectedOptionId })
        .from(termTestAnswers)
        .where(eq(termTestAnswers.attemptId, attempt.id))
    : [];
  const selectedByQuestion = new Map(answers.map((a) => [a.questionId, a.selectedOptionId]));

  const corrections: TermTestCorrection[] = questions.map((q) => {
    const qOptions = options.filter((o) => o.questionId === q.id);
    const correct = qOptions.find((o) => o.isCorrect);
    const selectedId = selectedByQuestion.get(q.id) ?? null;
    const selected = selectedId ? qOptions.find((o) => o.id === selectedId) : undefined;
    return {
      questionId: q.id,
      prompt: q.prompt,
      selectedOptionText: selected?.text ?? null,
      correctOptionText: correct?.text ?? "",
      isCorrect: selected ? selected.id === correct?.id : false,
    };
  });

  return {
    score: attempt?.score ?? 0,
    total: attempt?.total ?? corrections.length,
    corrections,
  };
}

// Shared "released" branch: cohort, board (ranked around `viewerId`), and
// the viewer's corrections. Callers have already checked permissions and
// the release gate before calling this.
async function buildReleasedResults(
  quiz: ApprovedTermTest,
  viewerId: string,
  cohort?: CohortMember[],
): Promise<TermTestResults> {
  const resolvedCohort = cohort ?? (await getTermTestCohort(quiz.subjectId, quiz.resultsReleaseAt));
  const attempts: AttemptScore[] = await db
    .select({ studentId: termTestAttempts.studentId, score: termTestAttempts.score, submittedAt: termTestAttempts.submittedAt })
    .from(termTestAttempts)
    .where(eq(termTestAttempts.quizId, quiz.id));
  const board = rankTermTestBoard(resolvedCohort, attempts, viewerId);
  const { score, total, corrections } = await buildCorrectionsAndScore(quiz.id, viewerId);

  return {
    released: true,
    quizId: quiz.id,
    title: quiz.title,
    score,
    total,
    board,
    corrections,
  };
}

/**
 * Student's own term-test results. Returns null if the quiz does not exist,
 * is not an approved term test, has no release date set, or the student is
 * not in the test's cohort (not enrolled, active at the deadline, in a class
 * of the quiz's subject) - a student outside the cohort must not learn the
 * board or the answer key for a subject they are not in. Before
 * `resultsReleaseAt`, returns `{ released: false }` without touching the
 * board, scores, or the answer key - the release gate is checked first and
 * nothing past it runs until `now >= resultsReleaseAt`.
 */
export async function getStudentTermTestResults(
  studentId: string,
  quizId: string,
): Promise<TermTestResults | null> {
  const quiz = await loadApprovedTermTest(quizId);
  if (!quiz) return null;

  const cohort = await getTermTestCohort(quiz.subjectId, quiz.resultsReleaseAt);
  if (!cohort.some((m) => m.studentId === studentId)) return null;

  if (Date.now() < quiz.resultsReleaseAt.getTime()) {
    return { released: false, quizId: quiz.id, title: quiz.title, resultsReleaseAt: quiz.resultsReleaseAt };
  }

  return buildReleasedResults(quiz, studentId, cohort);
}

/**
 * Parent's read-only view of a child's term-test results. Verifies the
 * family link and the child's cohort membership before returning anything -
 * both checks run ahead of, and regardless of, the release gate, so a
 * parent with no valid link or an out-of-cohort child learns nothing about
 * whether results exist or have been released. Ranks the board with the
 * child as "me".
 */
export async function getParentTermTestResults(
  parentId: string,
  childId: string,
  quizId: string,
): Promise<TermTestResults | null> {
  const [link] = await db
    .select({ parentId: familyLinks.parentId })
    .from(familyLinks)
    .where(and(eq(familyLinks.parentId, parentId), eq(familyLinks.studentId, childId)))
    .limit(1);
  if (!link) return null;

  const quiz = await loadApprovedTermTest(quizId);
  if (!quiz) return null;

  const cohort = await getTermTestCohort(quiz.subjectId, quiz.resultsReleaseAt);
  if (!cohort.some((m) => m.studentId === childId)) return null;

  if (Date.now() < quiz.resultsReleaseAt.getTime()) {
    return { released: false, quizId: quiz.id, title: quiz.title, resultsReleaseAt: quiz.resultsReleaseAt };
  }

  return buildReleasedResults(quiz, childId, cohort);
}
