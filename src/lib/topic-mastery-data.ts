import "server-only";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  homework,
  homeworkAssignments,
  quizAttempts,
  quizzes,
  subjectTopics,
  subjectWeeks,
} from "@/db/schema";
import { isMarked } from "@/lib/homework-rules";
import { meanMastery, topicMastery, type TopicMastery } from "@/lib/topic-mastery";

export type SubjectMastery = {
  subjectId: string;
  /** Mean of the topics with marks; null before anything is marked. */
  percent: number | null;
  /** Every topic of the subject's curriculum, in curriculum order. */
  topics: TopicMastery[];
};

/**
 * One student's topic mastery in each of `subjectIds`, from their marks
 * (`topic-mastery`). The one loader behind student Progress, parent
 * Progress and the parent Overview. Reads curriculum topics and weeks,
 * marked homework and quiz attempts; `progress_topics` is no longer read.
 */
export async function getSubjectMastery(
  studentId: string,
  subjectIds: readonly string[],
): Promise<Map<string, SubjectMastery>> {
  const out = new Map<string, SubjectMastery>();
  if (subjectIds.length === 0) return out;
  const ids = [...new Set(subjectIds)];

  const [topicRows, weekRows, homeworkRows, attemptRows] = await Promise.all([
    db
      .select({ id: subjectTopics.id, subjectId: subjectTopics.subjectId, name: subjectTopics.name })
      .from(subjectTopics)
      .where(inArray(subjectTopics.subjectId, ids))
      .orderBy(asc(subjectTopics.position), asc(subjectTopics.name)),
    db
      .select({ id: subjectWeeks.id, topicId: subjectWeeks.topicId })
      .from(subjectWeeks)
      .where(and(inArray(subjectWeeks.subjectId, ids), isNotNull(subjectWeeks.topicId))),
    db
      .select({
        weekId: homework.weekId,
        status: homeworkAssignments.status,
        score: homeworkAssignments.score,
      })
      .from(homeworkAssignments)
      .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
      .innerJoin(subjectWeeks, eq(subjectWeeks.id, homework.weekId))
      .where(
        and(
          eq(homeworkAssignments.studentId, studentId),
          inArray(subjectWeeks.subjectId, ids),
          isNotNull(homeworkAssignments.score),
        ),
      ),
    db
      .select({
        quizId: quizAttempts.quizId,
        weekId: quizzes.subjectWeekId,
        correctCount: quizAttempts.correctCount,
        total: quizAttempts.total,
        submittedAt: quizAttempts.submittedAt,
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
      .where(and(eq(quizAttempts.studentId, studentId), inArray(quizzes.subjectId, ids))),
  ]);

  const weeksByTopic = new Map<string, string[]>();
  for (const w of weekRows) {
    if (!w.topicId) continue;
    weeksByTopic.set(w.topicId, [...(weeksByTopic.get(w.topicId) ?? []), w.id]);
  }
  // The latest attempt at each quiz is the one that counts.
  const latest = new Map<string, (typeof attemptRows)[number]>();
  for (const a of attemptRows) {
    const prev = latest.get(a.quizId);
    if (!prev || a.submittedAt > prev.submittedAt) latest.set(a.quizId, a);
  }
  const marks = {
    homework: homeworkRows
      .filter((h) => isMarked(h.status) && h.score !== null)
      .map((h) => ({ weekId: h.weekId, score: h.score as string })),
    quizzes: [...latest.values()],
  };

  for (const subjectId of ids) {
    const topics = topicMastery(
      topicRows
        .filter((t) => t.subjectId === subjectId)
        .map((t) => ({ topicId: t.id, name: t.name, weekIds: weeksByTopic.get(t.id) ?? [] })),
      marks,
    );
    out.set(subjectId, { subjectId, percent: meanMastery(topics), topics });
  }
  return out;
}
