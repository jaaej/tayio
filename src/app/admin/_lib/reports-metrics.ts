export type ClassMetricRow = {
  classId: string;
  className: string;
  tutorName: string;
  attended: number;
  markedLessons: number;
  homeworkCompleted: number;
  homeworkAssigned: number;
  enrolled: number;
  capacity: number;
  testScoreSum: number;
  testScoreCount: number;
};

export type ClassReportRow = {
  classId: string;
  className: string;
  tutorName: string;
  attendancePct: number | null;
  homeworkPct: number | null;
  avgTestResult: number | null;
  enrolled: number;
  capacity: number;
};

export type OrgRollup = {
  attendancePct: number | null;
  homeworkPct: number | null;
  fillPct: number | null;
};

/** Integer percentage, or null when the denominator is zero. */
export function ratePct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

/** Average rounded to one decimal, or null when there are no values. */
export function avgScore(sum: number, count: number): number | null {
  if (count <= 0) return null;
  return Math.round((sum / count) * 10) / 10;
}

export function toClassReportRow(r: ClassMetricRow): ClassReportRow {
  return {
    classId: r.classId,
    className: r.className,
    tutorName: r.tutorName,
    attendancePct: ratePct(r.attended, r.markedLessons),
    homeworkPct: ratePct(r.homeworkCompleted, r.homeworkAssigned),
    avgTestResult: avgScore(r.testScoreSum, r.testScoreCount),
    enrolled: r.enrolled,
    capacity: r.capacity,
  };
}

export function rollupOrgWide(rows: ClassMetricRow[]): OrgRollup {
  const sum = (pick: (r: ClassMetricRow) => number) =>
    rows.reduce((acc, r) => acc + pick(r), 0);
  return {
    attendancePct: ratePct(sum((r) => r.attended), sum((r) => r.markedLessons)),
    homeworkPct: ratePct(
      sum((r) => r.homeworkCompleted),
      sum((r) => r.homeworkAssigned),
    ),
    fillPct: ratePct(sum((r) => r.enrolled), sum((r) => r.capacity)),
  };
}
