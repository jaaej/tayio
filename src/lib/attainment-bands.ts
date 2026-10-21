/**
 * The term report's 1 to 6 ratings (owner decisions, 21 October 2026).
 *
 * A student's score for a topic is the average of their topic tests and the
 * topic's major quizzes (each a percentage, each counting once). The
 * rating places that score among every student in the same subject that
 * term, on a bell curve: the standard split of percentiles below. With fewer
 * than ten students scored there is no meaningful curve, so the score itself
 * is banded instead. The subject's overall rating does the same with all of
 * the term's tests and major quizzes.
 */

export const BANDS = [
  { value: 1, label: "Below average" },
  { value: 2, label: "Low average" },
  { value: 3, label: "Average" },
  { value: 4, label: "High average" },
  { value: 5, label: "Above average" },
  { value: 6, label: "Proficient" },
] as const;

export type Band = (typeof BANDS)[number]["value"];

export function bandLabel(band: Band): string {
  return BANDS[band - 1].label;
}

/** Fewer scored students than this, and the score itself is banded. */
export const MIN_CURVE_COHORT = 10;

/**
 * Percentile rank of a score within its cohort (the cohort includes it):
 * the share below it plus half the share level with it, so equal scores
 * always share a rank.
 */
export function percentileRank(score: number, cohort: readonly number[]): number {
  if (cohort.length === 0) return 0;
  const below = cohort.filter((s) => s < score).length;
  const equal = cohort.filter((s) => s === score).length;
  return ((below + equal / 2) / cohort.length) * 100;
}

/** The standard split: top 2% Proficient down to the bottom 8% Below average. */
export function bandFromPercentile(rank: number): Band {
  if (rank >= 98) return 6;
  if (rank >= 91) return 5;
  if (rank >= 75) return 4;
  if (rank >= 25) return 3;
  if (rank >= 9) return 2;
  return 1;
}

/** Fixed bands on the percentage, for a cohort too small to curve. */
export function bandFromScore(percent: number): Band {
  if (percent >= 90) return 6;
  if (percent >= 80) return 5;
  if (percent >= 70) return 4;
  if (percent >= 60) return 3;
  if (percent >= 50) return 2;
  return 1;
}

/** Each scored student's band within their cohort (student id to score). */
export function rateCohort(scores: ReadonlyMap<string, number>): Map<string, Band> {
  const all = [...scores.values()];
  const curve = all.length >= MIN_CURVE_COHORT;
  const bands = new Map<string, Band>();
  for (const [id, score] of scores) {
    bands.set(id, curve ? bandFromPercentile(percentileRank(score, all)) : bandFromScore(score));
  }
  return bands;
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * A student's score from their test and major quiz percentages: each one
 * counts once, so a single quiz never outweighs several tests; null with
 * neither.
 */
export function attainmentScore(tests: readonly number[], quizzes: readonly number[]): number | null {
  return mean([...tests, ...quizzes]);
}

export type StripLesson = {
  date: string;
  /** The student's mark, or null when it was not marked. */
  status: string | null;
  /** Taiyo cancelled it. */
  cancelled: boolean;
};

export type StripCell = { date: string; state: "attended" | "made_up" | "missed" | "cancelled" | "unmarked" };

const ATTENDED = new Set(["present", "late", "left_early", "makeup_attended"]);

function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * A class's lessons for the attendance history, oldest first: attended is
 * green, missed red, but a missed lesson counts as made up when the student
 * attended a make-up in the same Monday-to-Sunday week (`makeupDates`).
 */
export function attendanceStrip(lessons: readonly StripLesson[], makeupDates: readonly string[]): StripCell[] {
  const madeUpWeeks = new Set(makeupDates.map(mondayOf));
  return [...lessons]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => ({
      date: l.date,
      state: l.cancelled
        ? "cancelled"
        : l.status === null
          ? "unmarked"
          : ATTENDED.has(l.status)
            ? "attended"
            : madeUpWeeks.has(mondayOf(l.date))
              ? "made_up"
              : "missed",
    }));
}
