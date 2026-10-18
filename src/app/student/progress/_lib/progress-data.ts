import "server-only";
import { cache } from "react";
import { and, desc, eq, like, min } from "drizzle-orm";
import { db } from "@/db/client";
import {
  enrollments,
  notifications,
  quizAttempts,
  quizzes,
  subjectWeeks,
  terms,
} from "@/db/schema";
import { melbourneDayKey } from "@/lib/format";
import { averageScore } from "@/lib/score-average";
import { meanMastery, type MasteryLevel } from "@/lib/topic-mastery";
import { getSubjectMastery } from "@/lib/topic-mastery-data";
import {
  getStudentOverallSubjectRank,
  getStudentProgressBySubject,
  getStudentProgressSubjectDetail,
} from "../../_lib/queries";
import {
  inTerm,
  isMarkedHomework,
  issuedReportTermIds,
  latestQuizResults,
  pickTerm,
  progressTerms,
  recentMarks,
  type ProgressTerm,
  type RecentMark,
} from "./progress";

export type ProgressPaneSubject = {
  subjectId: string;
  subjectName: string;
  subjectColor: string | null;
  /** From marks (`topic-mastery`); null before anything is marked. */
  masteryPercent: number | null;
};

export type ProgressReport = { termId: string; label: string; href: string };

export type ProgressPaneData = {
  overall: number | null;
  subjects: ProgressPaneSubject[];
  terms: ProgressTerm[];
  /** The term shown when the URL names none (the term running today). */
  defaultTermId: string | null;
  /** Issued term reports, newest term first; null when the student may not
   *  open their own reports (parental access: reports go to the parent). */
  reports: ProgressReport[] | null;
};

/**
 * The terms this student can look back on, with all term rows for labelling
 * reports. Cached per request: the layout and the page both need it.
 */
const getStudentTerms = cache(async (studentId: string) => {
  const [termRows, [first]] = await Promise.all([
    db
      .select({
        id: terms.id,
        year: terms.year,
        termNumber: terms.termNumber,
        startDate: terms.startDate,
        endDate: terms.endDate,
      })
      .from(terms),
    db
      .select({ at: min(enrollments.enrolledAt) })
      .from(enrollments)
      .where(eq(enrollments.studentId, studentId)),
  ]);
  const today = melbourneDayKey(new Date());
  const firstEnrolledOn = first?.at ? melbourneDayKey(new Date(first.at)) : null;
  return { termRows, today, offered: progressTerms(termRows, firstEnrolledOn, today) };
});

/** Reports issued to this student ("Term report ready" notifications). */
async function getIssuedReports(
  studentId: string,
  termRows: Array<{ id: string; year: number; termNumber: number; startDate: string }>,
): Promise<ProgressReport[]> {
  const rows = await db
    .select({ href: notifications.href })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, studentId),
        like(notifications.href, `/reports/${studentId}/%`),
      ),
    )
    .orderBy(desc(notifications.createdAt));
  const byId = new Map(termRows.map((t) => [t.id, t]));
  return issuedReportTermIds(
    rows.map((r) => r.href),
    studentId,
  )
    .map((id) => byId.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .map((t) => ({
      termId: t.id,
      label: `Term ${t.termNumber} · ${t.year}`,
      href: `/reports/${studentId}/${t.id}`,
    }));
}

/**
 * The list pane: overall mastery, one row per enrolled subject, the term
 * picker's options and the student's reports. Cached per request, since the
 * layout and the index page both need it.
 */
export const getProgressPane = cache(
  async (studentId: string, canOpenReports: boolean): Promise<ProgressPaneData> => {
    const [subjects, { termRows, today, offered }] = await Promise.all([
      getStudentProgressBySubject(studentId),
      getStudentTerms(studentId),
    ]);
    const mastery = await getSubjectMastery(
      studentId,
      subjects.map((s) => s.subjectId),
    );
    const paneSubjects = subjects.map((s) => ({
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      subjectColor: s.subjectColor,
      masteryPercent: mastery.get(s.subjectId)?.percent ?? null,
    }));
    return {
      overall: meanMastery(paneSubjects.map((s) => ({ percent: s.masteryPercent }))),
      subjects: paneSubjects,
      terms: offered,
      defaultTermId: pickTerm(offered, null, today)?.id ?? null,
      reports: canOpenReports ? await getIssuedReports(studentId, termRows) : null,
    };
  },
);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProgressDetail = {
  subjectId: string;
  subjectName: string;
  subjectColor: string | null;
  yearLevel: string | null;
  /** From marks (`topic-mastery`); null before anything is marked. */
  masteryPercent: number | null;
  rank: { rank: number; total: number } | null;
  averagePercent: number | null;
  /** Every curriculum topic; percent and level are null with no marks yet. */
  topics: Array<{ topicId: string; topic: string; percent: number | null; level: MasteryLevel | null }>;
  marks: RecentMark[];
};

/**
 * One subject's progress in a term, or null when the student is not
 * enrolled in it (getStudentProgressSubjectDetail checks the enrolment
 * first, so a guessed subject id 404s instead of leaking anything).
 * Marks, the average and the test rank cover the chosen term (homework by
 * due date, quizzes by their curriculum week); topic mastery is worked out
 * from every mark so far, so it is always the current level.
 */
export async function getProgressDetail(
  studentId: string,
  subjectId: string,
  termId: string | null | undefined,
): Promise<ProgressDetail | null> {
  // A malformed id would make Postgres throw on the uuid cast; it is a 404.
  if (!UUID.test(subjectId)) return null;
  const [detail, { today, offered }] = await Promise.all([
    getStudentProgressSubjectDetail(studentId, subjectId),
    getStudentTerms(studentId),
  ]);
  if (!detail) return null;
  const term = pickTerm(offered, termId, today);

  const [rank, attemptRows, mastery] = await Promise.all([
    getStudentOverallSubjectRank(studentId, subjectId, term ?? undefined),
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
      .innerJoin(subjectWeeks, eq(subjectWeeks.id, quizzes.subjectWeekId))
      .where(
        and(
          eq(quizAttempts.studentId, studentId),
          eq(quizzes.subjectId, subjectId),
          term ? eq(subjectWeeks.termId, term.id) : undefined,
        ),
      ),
    getSubjectMastery(studentId, [subjectId]),
  ]);
  const subjectMastery = mastery.get(subjectId);

  const homework = term
    ? detail.homework.filter((h) => inTerm(melbourneDayKey(h.dueDate), term))
    : detail.homework;
  const quizResults = latestQuizResults(attemptRows);
  const avg = averageScore(
    homework.filter(isMarkedHomework).map((h) => h.score),
    quizResults,
  );

  return {
    subjectId: detail.subjectId,
    subjectName: detail.subjectName,
    subjectColor: detail.subjectColor,
    yearLevel: detail.yearLevel,
    masteryPercent: subjectMastery?.percent ?? null,
    rank,
    averagePercent: avg.percent,
    topics: (subjectMastery?.topics ?? []).map((t) => ({
      topicId: t.topicId,
      topic: t.topic,
      percent: t.percent,
      level: t.level,
    })),
    marks: recentMarks(homework, quizResults),
  };
}
