import { describe, expect, it } from "vitest";
import { studentSearchEntries } from "./student-search";

describe("studentSearchEntries", () => {
  it("lists each student once with all their classes, sorted by name", () => {
    const entries = studentSearchEntries([
      {
        className: "Tuesday",
        subjectName: "Year 9 Maths",
        students: [
          { id: "s2", firstName: "Uma", lastName: "Pro" },
          { id: "s1", firstName: "Sarah", lastName: "Student" },
        ],
      },
      {
        className: "Thursday",
        subjectName: "Year 9 English",
        students: [{ id: "s1", firstName: "Sarah", lastName: "Student" }],
      },
      { className: "Friday", subjectName: "Year 9 Maths", students: [] },
    ]);
    expect(entries).toEqual([
      { label: "Sarah Student", href: "/tutor/students/s1", section: "Year 9 Maths · Tuesday, Year 9 English · Thursday" },
      { label: "Uma Pro", href: "/tutor/students/s2", section: "Year 9 Maths · Tuesday" },
    ]);
  });
});
