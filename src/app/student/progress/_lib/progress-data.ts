import "server-only";
import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { quizAttempts, quizzes } from "@/db/schema";
import { averageScore, scoreAverageBasis } from "@/lib/score-average";
import {
  MASTERY_PERCENT,
  getStudentOverallSubjectRank,
  getStudentProgressBySubject,
  getStudentProgressSubjectDetail,
} from "../../_lib/queries";
import {
  focusTopic,
  homeworkCounts,
  isMarkedHomework,
  latestQuizResults,
  overallSummary,
  recentMarks,
  type Mastery,
  type RecentMark,
} from "./progress";

export type ProgressPaneSubject = {
  subjectId: string;
  subjectName: string;
  masteryPercent: number;
  topicCount: number;
  focus: string | null;
};

export type ProgressPaneData = {
  overall: ReturnType<typeof overallSummary>;
  subjects: ProgressPaneSubject[];
};

/**
 * The list pane: overall mastery and one row per enrolled subject. Cached
 * per request, since the layout and the index page both need it.
 */
export const getProgressPane = cache(async (studentId: string): Promise<ProgressPaneData> => {
  const subjects = await getStudentProgressBySubject(studentId);
  return {
    overall: overallSummary(subjects),
    subjects: subjects.map((s) => ({
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      masteryPercent: s.masteryPercent,
      topicCount: s.topics.length,
      focus: focusTopic(s.topics),
    })),
  };
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProgressDetail = {
  subjectId: string;
  subjectName: string;
  yearLevel: string | null;
  masteryPercent: number;
  rank: { rank: number; total: number } | null;
  average: { percent: number | null; basis: string };
  submitted: number;
  pending: number;
  topics: Array<{ topic: string; mastery: Mastery; percent: number }>;
  marks: RecentMark[];
};

/**
 * One subject's progress, or null when the student is not enrolled in it
 * (getStudentProgressSubjectDetail checks the enrolment first, so a guessed
 * subject id 404s instead of leaking anything).
 */
export async function getProgressDetail(
  studentId: string,
  subjectId: string,
): Promise<ProgressDetail | null> {
  // A malformed id would make Postgres throw on the uuid cast; it is a 404.
  if (!UUID.test(subjectId)) return null;
  const detail = await getStudentProgressSubjectDetail(studentId, subjectId);
  if (!detail) return null;

  const [rank, attemptRows] = await Promise.all([
    getStudentOverallSubjectRank(studentId, subjectId),
    db
      .select({
        quizId: quizAttempts.quizId,
        title: quizzes.title,
        correctCount: quizAttempts.correctCount,
        total: quizAttempts.total,
        submittedAt: quizAttempts.submittedAt,
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
      .where(and(eq(quizAttempts.studentId, studentId), eq(quizzes.subjectId, subjectId))),
  ]);

  const quizResults = latestQuizResults(attemptRows);
  const avg = averageScore(
    detail.homework.filter(isMarkedHomework).map((h) => h.score),
    quizResults,
  );
  const counts = homeworkCounts(detail.homework);

  return {
    subjectId: detail.subjectId,
    subjectName: detail.subjectName,
    yearLevel: detail.yearLevel,
    masteryPercent: detail.masteryPercent,
    rank,
    average: { percent: avg.percent, basis: scoreAverageBasis(avg) },
    submitted: counts.submitted,
    pending: counts.pending,
    topics: detail.topics.map((t) => ({ ...t, percent: MASTERY_PERCENT[t.mastery] })),
    marks: recentMarks(detail.homework, quizResults),
  };
}
