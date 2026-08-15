/**
 * Report grade scheme (student term reports).
 *
 * A letter is derived from a percentage that combines the student's quiz and
 * test averages with EQUAL weight. If only one of the two exists, that average
 * is used alone; if neither exists, the grade is null (nothing to grade yet).
 *
 * Bands (owner deferred to a sensible default): A >= 90, B 80-89, C 70-79,
 * D 60-69, F < 60.
 */
export type Letter = "A" | "B" | "C" | "D" | "F";

export function letterFor(percent: number): Letter {
  if (percent >= 90) return "A";
  if (percent >= 80) return "B";
  if (percent >= 70) return "C";
  if (percent >= 60) return "D";
  return "F";
}

/** Average of a list of percentages (0-100), or null if empty. */
export function average(percents: number[]): number | null {
  if (percents.length === 0) return null;
  const sum = percents.reduce((a, b) => a + b, 0);
  return sum / percents.length;
}

export type ReportGrade = {
  percent: number;
  letter: Letter;
  quizPercent: number | null;
  testPercent: number | null;
};

/**
 * Combine a quiz average and a test average (each 0-100 or null) into an
 * overall percentage + letter, weighting the two components equally. Returns
 * null when there is no score data at all.
 */
export function combineGrade(
  quizPercent: number | null,
  testPercent: number | null,
): ReportGrade | null {
  const parts: number[] = [];
  if (quizPercent !== null) parts.push(quizPercent);
  if (testPercent !== null) parts.push(testPercent);
  if (parts.length === 0) return null;
  const percent = parts.reduce((a, b) => a + b, 0) / parts.length;
  const rounded = Math.round(percent * 10) / 10;
  return {
    percent: rounded,
    letter: letterFor(rounded),
    quizPercent,
    testPercent,
  };
}
