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
  // Neutralize CSV formula injection: a leading =, +, -, @, tab, or CR makes
  // spreadsheet apps interpret the cell as a formula. Prefix a single quote so
  // it is treated as text. RFC 4180 quoting alone does NOT prevent this.
  let value = field;
  if (/^[=+\-@\t\r]/.test(value)) {
    value = `'${value}`;
  }
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
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
