import { averageScore } from "@/lib/score-average";

/*
 * Topic mastery, worked out from marks (owner decision, 18 October 2026):
 * a topic's mastery is the average of the student's quiz scores and marked
 * homework (as percentages) in that topic's curriculum weeks, with the same
 * weighting as every other average (`averageScore`: each item counts once,
 * a quiz at its latest attempt). A topic with no marks has no mastery yet;
 * it is never 0%.
 */

export type MasteryLevel = "strong" | "improving" | "needs_work";

/** The level a mastery percentage reads as: 80+ strong, 60+ improving. */
export function masteryLevel(percent: number): MasteryLevel {
  if (percent >= 80) return "strong";
  if (percent >= 60) return "improving";
  return "needs_work";
}

export const MASTERY_LEVEL_LABEL: Record<MasteryLevel, string> = {
  strong: "All good",
  improving: "Improving",
  needs_work: "Needs focused effort",
};

export type MasteryTopic = { topicId: string; name: string; weekIds: readonly string[] };

export type MasteryMarks = {
  /** Marked homework: its curriculum week and the tutor's percentage. */
  homework: ReadonlyArray<{ weekId: string | null; score: string | number }>;
  /** Each quiz's latest attempt and its curriculum week. */
  quizzes: ReadonlyArray<{ weekId: string; correctCount: number; total: number }>;
};

export type TopicMastery = {
  topicId: string;
  topic: string;
  /** Null when nothing in the topic has been marked yet. */
  percent: number | null;
  level: MasteryLevel | null;
  markCount: number;
};

export function topicMastery(
  topics: readonly MasteryTopic[],
  marks: MasteryMarks,
): TopicMastery[] {
  return topics.map((t) => {
    const weeks = new Set(t.weekIds);
    const avg = averageScore(
      marks.homework.filter((h) => h.weekId !== null && weeks.has(h.weekId)).map((h) => h.score),
      marks.quizzes.filter((q) => weeks.has(q.weekId)),
    );
    return {
      topicId: t.topicId,
      topic: t.name,
      percent: avg.percent,
      level: avg.percent === null ? null : masteryLevel(avg.percent),
      markCount: avg.homeworkCount + avg.quizCount,
    };
  });
}

/**
 * A subject's (or a student's) mastery: the mean of the parts that have
 * marks, each part counting once. Null when none has any.
 */
export function meanMastery(parts: ReadonlyArray<{ percent: number | null }>): number | null {
  const scored = parts.filter((p): p is { percent: number } => p.percent !== null);
  if (scored.length === 0) return null;
  return Math.round(scored.reduce((sum, p) => sum + p.percent, 0) / scored.length);
}
