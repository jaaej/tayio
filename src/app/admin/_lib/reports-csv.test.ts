import { describe, it, expect } from "vitest";
import { classReportToCsv } from "./reports-csv";
import type { ClassReportRow } from "./reports-metrics";

function r(over: Partial<ClassReportRow> = {}): ClassReportRow {
  return {
    classId: "c",
    subjectId: "s",
    className: "Saturday AM",
    subjectName: "Maths",
    subjectColor: null,
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
      "Subject,Class,Tutor,Attendance %,Homework %,Avg test result,Enrolled,Capacity",
    );
    expect(lines[1]).toBe("Maths,Saturday AM,Chen,80,75,78.5,6,8");
  });
  it("names the class once, without the subject it already repeats", () => {
    const csv = classReportToCsv([r({ className: "Maths · Saturday AM" })]);
    expect(csv.split("\n")[1]).toBe("Maths,Saturday AM,Chen,80,75,78.5,6,8");
  });
  it("renders null metrics as empty cells", () => {
    const csv = classReportToCsv([
      r({ attendancePct: null, homeworkPct: null, avgTestResult: null }),
    ]);
    expect(csv.split("\n")[1]).toBe("Maths,Saturday AM,Chen,,,,6,8");
  });
  it("quotes and escapes fields containing commas or quotes", () => {
    const csv = classReportToCsv([
      r({ className: "Sat, AM", tutorName: 'A "B"' }),
    ]);
    expect(csv.split("\n")[1]).toBe('Maths,"Sat, AM","A ""B""",80,75,78.5,6,8');
  });
  it("neutralizes CSV formula injection by prefixing risky leading chars", () => {
    expect(classReportToCsv([r({ className: "=1+1" })]).split("\n")[1]).toBe(
      "Maths,'=1+1,Chen,80,75,78.5,6,8",
    );
    expect(classReportToCsv([r({ tutorName: "-2+3" })]).split("\n")[1]).toBe(
      "Maths,Saturday AM,'-2+3,80,75,78.5,6,8",
    );
    expect(classReportToCsv([r({ tutorName: "@cmd" })]).split("\n")[1]).toBe(
      "Maths,Saturday AM,'@cmd,80,75,78.5,6,8",
    );
  });
});
