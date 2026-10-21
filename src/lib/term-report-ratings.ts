import "server-only";
import { and, asc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, homework, homeworkAssignments, quizAttempts, quizzes, subjectTopics, subjectWeeks } from "@/db/schema";
import { attainmentScore, rateCohort, type Band } from "@/lib/attainment-bands";

/*
 * The term report's ratings for one subject and term: every student's score
 * per topic and overall from the term's topic tests and major quizzes, and
 * their band among everyone in the subject (`rateCohort`). Also each
 * student's full list of quiz and test results, practice quizzes included.
 */

export type ResultRow = {
  studentId: string;
  label: string;
  percent: number;
  kind: "test" | "quiz";
  /** A test or a major quiz: it counts towards the ratings. */
  counts: boolean;
  topicId: string | null;
  week: number | null;
};

export type SubjectRatings = {
  /** The subject's topics taught this term, in curriculum order. */
  topics: { id: string; name: string }[];
  topicBands: Map<string, Map<string, { band: Band; score: number }>>;
  overall: Map<string, { band: Band; score: number }>;
  results: ResultRow[];
};

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export async function getSubjectRatings(
  subjectId: string,
  term: { id: string; startDate: string; endDate: string },
): Promise<SubjectRatings> {
  const start = new Date(`${term.startDate}T00:00:00`);
  const endExclusive = new Date(`${term.endDate}T00:00:00`);
  endExclusive.setDate(endExclusive.getDate() + 1);

  const [topicRows, testRows, attemptRows] = await Promise.all([
    db
      .selectDistinct({ id: subjectTopics.id, name: subjectTopics.name, position: subjectTopics.position })
      .from(subjectWeeks)
      .innerJoin(subjectTopics, eq(subjectTopics.id, subjectWeeks.topicId))
      .where(and(eq(subjectWeeks.subjectId, subjectId), eq(subjectWeeks.termId, term.id)))
      .orderBy(asc(subjectTopics.position), asc(subjectTopics.name)),
    // Scored tests of the subject due in the term: a test set in a week
    // belongs to that week's topic; one set on a class alone counts overall.
    db
      .select({
        studentId: homeworkAssignments.studentId,
        score: homeworkAssignments.score,
        title: homework.title,
        topicId: subjectWeeks.topicId,
        week: subjectWeeks.weekNumber,
      })
      .from(homeworkAssignments)
      .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
      .leftJoin(classes, eq(classes.id, homework.classId))
      .leftJoin(subjectWeeks, eq(subjectWeeks.id, homework.weekId))
      .where(
        and(
          eq(homework.isTest, true),
          isNotNull(homeworkAssignments.score),
          sql`coalesce(${subjectWeeks.subjectId}, ${classes.subjectId}) = ${subjectId}`,
          gte(homework.dueDate, start),
          lt(homework.dueDate, endExclusive),
        ),
      ),
    // Every quiz of the subject in the term; the latest attempt counts.
    db
      .select({
        studentId: quizAttempts.studentId,
        quizId: quizAttempts.quizId,
        title: quizzes.title,
        isMajor: quizzes.isMajor,
        correct: quizAttempts.correctCount,
        total: quizAttempts.total,
        submittedAt: quizAttempts.submittedAt,
        topicId: subjectWeeks.topicId,
        week: subjectWeeks.weekNumber,
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
      .innerJoin(subjectWeeks, eq(subjectWeeks.id, quizzes.subjectWeekId))
      .where(and(eq(quizzes.subjectId, subjectId), eq(subjectWeeks.termId, term.id))),
  ]);

  const latest = new Map<string, (typeof attemptRows)[number]>();
  for (const a of attemptRows) {
    const key = `${a.studentId}:${a.quizId}`;
    const prev = latest.get(key);
    if (!prev || a.submittedAt > prev.submittedAt) latest.set(key, a);
  }

  const results: ResultRow[] = [
    ...testRows.map((t) => ({
      studentId: t.studentId,
      label: t.week ? `Week ${t.week} · ${t.title}` : t.title,
      percent: Math.round(clampPct(Number(t.score))),
      kind: "test" as const,
      counts: true,
      topicId: t.topicId,
      week: t.week,
    })),
    ...[...latest.values()]
      .filter((a) => a.total > 0)
      .map((a) => ({
        studentId: a.studentId,
        label: `Week ${a.week} · ${a.title}`,
        percent: Math.round(clampPct((a.correct / a.total) * 100)),
        kind: "quiz" as const,
        counts: a.isMajor,
        topicId: a.topicId,
        week: a.week,
      })),
  ];

  // Scores from what counts: per student per topic, and per student overall.
  const scored = results.filter((r) => r.counts);
  const students = [...new Set(scored.map((r) => r.studentId))];
  const score = (rows: ResultRow[]) =>
    attainmentScore(
      rows.filter((r) => r.kind === "test").map((r) => r.percent),
      rows.filter((r) => r.kind === "quiz").map((r) => r.percent),
    );

  const topicBands = new Map<string, Map<string, { band: Band; score: number }>>();
  for (const topic of topicRows) {
    const scores = new Map<string, number>();
    for (const id of students) {
      const s = score(scored.filter((r) => r.studentId === id && r.topicId === topic.id));
      if (s !== null) scores.set(id, s);
    }
    const bands = rateCohort(scores);
    topicBands.set(
      topic.id,
      new Map([...bands].map(([id, band]) => [id, { band, score: scores.get(id)! }])),
    );
  }

  const overallScores = new Map<string, number>();
  for (const id of students) {
    const s = score(scored.filter((r) => r.studentId === id));
    if (s !== null) overallScores.set(id, s);
  }
  const overall = new Map(
    [...rateCohort(overallScores)].map(([id, band]) => [id, { band, score: overallScores.get(id)! }]),
  );

  return { topics: topicRows.map((t) => ({ id: t.id, name: t.name })), topicBands, overall, results };
}

