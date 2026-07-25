import type { ClassReportRow } from "./reports-metrics";

const HEADER = [
  "Class",
  "Tutor",
  "Attendance %",
  "Homework %",
  "Avg test result",
  "Enrolled",
  "Capacity",
];

function escape(field: string): string {
  if (/[",\n]/.test(field)) return `"${field.replace(/"/g, '""')}"`;
  return field;
}

function num(value: number | null): string {
  return value === null ? "" : String(value);
}

export function classReportToCsv(rows: ClassReportRow[]): string {
  const lines = [HEADER.join(",")];
  for (const row of rows) {
    lines.push(
      [
        escape(row.className),
        escape(row.tutorName),
        num(row.attendancePct),
        num(row.homeworkPct),
        num(row.avgTestResult),
        String(row.enrolled),
        String(row.capacity),
      ].join(","),
    );
  }
  return lines.join("\n");
}
