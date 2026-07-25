import { describe, it, expect } from "vitest";
import { classReportToCsv } from "./reports-csv";
import type { ClassReportRow } from "./reports-metrics";

function r(over: Partial<ClassReportRow> = {}): ClassReportRow {
  return {
    classId: "c",
    className: "Maths",
    tutorName: "Chen",
    attendancePct: 80,
    homeworkPct: 75,
    avgTestResult: 78.5,
    enrolled: 6,
    capacity: 8,
    ...over,
  };
}

describe("classReportToCsv", () => {
  it("emits a header row then one row per class", () => {
    const csv = classReportToCsv([r()]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "Class,Tutor,Attendance %,Homework %,Avg test result,Enrolled,Capacity",
    );
    expect(lines[1]).toBe("Maths,Chen,80,75,78.5,6,8");
  });
  it("renders null metrics as empty cells", () => {
    const csv = classReportToCsv([
      r({ attendancePct: null, homeworkPct: null, avgTestResult: null }),
    ]);
    expect(csv.split("\n")[1]).toBe("Maths,Chen,,,,6,8");
  });
  it("quotes and escapes fields containing commas or quotes", () => {
    const csv = classReportToCsv([
      r({ className: "Maths, Yr10", tutorName: 'A "B"' }),
    ]);
    expect(csv.split("\n")[1]).toBe('"Maths, Yr10","A ""B""",80,75,78.5,6,8');
  });
});
