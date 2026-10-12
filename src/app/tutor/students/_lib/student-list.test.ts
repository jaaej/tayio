import { describe, expect, it } from "vitest";
import {
  attendanceSummary,
  distinctStudentCount,
  filterGroups,
  homeworkState,
  studentFlag,
  studentSubLine,
  withListQuery,
  yearKeyOf,
  yearOptions,
  type StudentListGroup,
} from "./student-list";

const row = (id: string, firstName: string, email = `${id}@x.com`) => ({
  id,
  firstName,
  lastName: "Test",
  email,
  avatarKey: null,
  sub: "",
  flag: null,
});

const groups: StudentListGroup[] = [
  {
    classId: "c1",
    label: "Year 9 Maths · Saturday AM",
    subjectName: "Year 9 Maths",
    yearKey: "year-9",
    students: [row("a", "Ava"), row("b", "Ben")],
  },
  {
    classId: "c2",
    label: "VCE Maths Methods",
    subjectName: "VCE Maths Methods",
    yearKey: "vce",
    students: [row("a", "Ava"), row("c", "Cleo", "cleo@school.edu")],
  },
  {
    classId: "c3",
    label: "Year 10 Maths",
    subjectName: "Year 10 Maths",
    yearKey: "year-10",
    students: [],
  },
];

describe("attendanceSummary", () => {
  it("counts late, left early and make-ups as attended", () => {
    expect(
      attendanceSummary(["present", "late", "left_early", "makeup_attended", "absent"]),
    ).toEqual({ attended: 4, total: 5, percent: 80 });
  });

  it("has no percentage before any lesson is marked", () => {
    expect(attendanceSummary([])).toEqual({ attended: 0, total: 0, percent: null });
  });
});

describe("homeworkState", () => {
  const today = "2026-10-12";
  it("treats submitted and late as waiting for marking", () => {
    expect(homeworkState("submitted", "2026-10-01", today)).toBe("to_mark");
    expect(homeworkState("late", "2026-10-01", today)).toBe("to_mark");
  });
  it("marks returned work as marked", () => {
    expect(homeworkState("returned", "2026-10-01", today)).toBe("marked");
  });
  it("splits work not handed in by its due date", () => {
    expect(homeworkState("not_started", "2026-10-11", today)).toBe("overdue");
    expect(homeworkState("viewed", "2026-10-12", today)).toBe("due_today");
    expect(homeworkState("resubmission_requested", "2026-10-13", today)).toBe("open");
  });
});

describe("studentFlag", () => {
  const none = { onLeave: false, overdue: 0, dueToday: 0, trial: false };
  it("is empty with nothing to flag", () => {
    expect(studentFlag(none)).toBeNull();
  });
  it("puts leave first, then overdue, due today and trial", () => {
    expect(studentFlag({ onLeave: true, overdue: 2, dueToday: 1, trial: true })?.label).toBe("On leave");
    expect(studentFlag({ ...none, overdue: 1, dueToday: 1, trial: true })?.label).toBe("Overdue");
    expect(studentFlag({ ...none, dueToday: 1, trial: true })?.label).toBe("Due today");
    expect(studentFlag({ ...none, trial: true })?.label).toBe("Trial");
  });
});

describe("studentSubLine", () => {
  it("joins attendance and overdue work", () => {
    expect(studentSubLine({ attended: 6, total: 8, percent: 75 }, 1, false)).toBe(
      "75% attendance · 1 overdue",
    );
  });
  it("says so when no lesson has been marked", () => {
    expect(studentSubLine({ attended: 0, total: 0, percent: null }, 0, false)).toBe(
      "No lessons marked yet",
    );
    expect(studentSubLine({ attended: 0, total: 0, percent: null }, 0, true)).toBe(
      "Free trial",
    );
  });
});

describe("filterGroups", () => {
  it("drops empty classes", () => {
    expect(filterGroups(groups, "", null).map((g) => g.classId)).toEqual(["c1", "c2"]);
  });
  it("matches name or email, case-insensitively", () => {
    expect(filterGroups(groups, "AVA", null).map((g) => g.classId)).toEqual(["c1", "c2"]);
    expect(filterGroups(groups, "school.edu", null)).toEqual([
      expect.objectContaining({ classId: "c2", students: [expect.objectContaining({ id: "c" })] }),
    ]);
  });
  it("narrows to one year level", () => {
    expect(filterGroups(groups, "", "vce").map((g) => g.classId)).toEqual(["c2"]);
  });
});

describe("distinctStudentCount", () => {
  it("counts a student in two classes once", () => {
    expect(distinctStudentCount(groups)).toBe(3);
  });
});

describe("year options", () => {
  it("normalises year spellings", () => {
    expect(yearKeyOf("Year 9")).toBe("year-9");
    expect(yearKeyOf("9")).toBe("year-9");
    expect(yearKeyOf(" VCE ")).toBe("vce");
    expect(yearKeyOf(null)).toBeNull();
  });
  it("orders numbered years before named levels, without duplicates", () => {
    expect(yearOptions(["VCE", "Year 10", "Year 9", "year 9", null])).toEqual([
      { key: "year-9", label: "Year 9" },
      { key: "year-10", label: "Year 10" },
      { key: "vce", label: "VCE" },
    ]);
  });
});

describe("withListQuery", () => {
  it("carries the list params and adds extras", () => {
    const sp = new URLSearchParams("q=ava&year=vce&tab=homework");
    expect(withListQuery("/tutor/students/a", sp)).toBe("/tutor/students/a?q=ava&year=vce");
    expect(withListQuery("/tutor/students/a", { q: "ava" }, { tab: "notes" })).toBe(
      "/tutor/students/a?q=ava&tab=notes",
    );
  });
});
