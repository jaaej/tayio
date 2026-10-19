import { describe, expect, it } from "vitest";
import {
  groupToMarkByClass,
  listHref,
  matchesQuery,
  nextToMark,
  parseMarkingView,
  sortToMark,
  submissionHref,
} from "./marking-list";

const item = (
  studentId: string,
  status: string,
  submittedAt: string | null,
  homeworkId = "hw1",
) => ({ homeworkId, studentId, status, submittedAt, studentName: studentId });

describe("sortToMark", () => {
  it("puts late work first, then the oldest submission", () => {
    const sorted = sortToMark([
      item("a", "submitted", "2026-10-03T00:00:00Z"),
      item("b", "late", "2026-10-05T00:00:00Z"),
      item("c", "submitted", "2026-10-01T00:00:00Z"),
      item("d", "late", "2026-10-04T00:00:00Z"),
    ]);
    expect(sorted.map((i) => i.studentId)).toEqual(["d", "b", "c", "a"]);
  });

  it("does not mutate the input", () => {
    const input = [item("a", "submitted", "2"), item("b", "late", "1")];
    sortToMark(input);
    expect(input.map((i) => i.studentId)).toEqual(["a", "b"]);
  });
});

describe("groupToMarkByClass", () => {
  const inClass = (studentId: string, status: string, classId: string | null) => ({
    ...item(studentId, status, null),
    classId,
    classLabel: classId ? `Class ${classId}` : null,
  });

  it("keeps the queue order, the class with the most urgent work first", () => {
    const groups = groupToMarkByClass(
      sortToMark([
        { ...inClass("a", "submitted", "c1"), submittedAt: "2026-10-01T00:00:00Z" },
        { ...inClass("b", "late", "c2"), submittedAt: "2026-10-05T00:00:00Z" },
        { ...inClass("c", "late", "c1"), submittedAt: "2026-10-06T00:00:00Z" },
        { ...inClass("d", "submitted", null), submittedAt: "2026-10-02T00:00:00Z" },
      ]),
    );
    expect(groups.map((g) => [g.key, g.label, g.items.map((i) => i.studentId)])).toEqual([
      ["c2", "Class c2", ["b"]],
      ["c1", "Class c1", ["c", "a"]],
      ["none", "Other homework", ["d"]],
    ]);
  });

  it("is empty with nothing to mark", () => {
    expect(groupToMarkByClass([])).toEqual([]);
  });
});

describe("nextToMark", () => {
  const queue = [item("a", "late", "1"), item("b", "submitted", "2"), item("c", "submitted", "3")];

  it("returns the following item, wrapping round", () => {
    expect(nextToMark(queue, { homeworkId: "hw1", studentId: "a" })?.studentId).toBe("b");
    expect(nextToMark(queue, { homeworkId: "hw1", studentId: "c" })?.studentId).toBe("a");
  });

  it("returns the first item when re-marking something outside the queue", () => {
    expect(nextToMark(queue, { homeworkId: "hw2", studentId: "a" })?.studentId).toBe("a");
  });

  it("returns null when the current item is the only one", () => {
    expect(nextToMark([queue[0]], { homeworkId: "hw1", studentId: "a" })).toBeNull();
    expect(nextToMark([], { homeworkId: "hw1", studentId: "a" })).toBeNull();
  });
});

describe("matchesQuery", () => {
  it("matches any field, ignoring case and blanks", () => {
    expect(matchesQuery(["Lucas Tran", null], "lucas")).toBe(true);
    expect(matchesQuery(["Lucas Tran", "Maths"], "MATH")).toBe(true);
    expect(matchesQuery(["Lucas Tran"], "ava")).toBe(false);
    expect(matchesQuery(["Lucas Tran"], "  ")).toBe(true);
  });
});

describe("URLs", () => {
  it("keeps the default view out of the URL", () => {
    expect(submissionHref("hw", "st", {})).toBe("/tutor/homework/hw?student=st");
    expect(submissionHref("hw", "st", { view: "marked", q: "ava" })).toBe(
      "/tutor/homework/hw?student=st&view=marked&q=ava",
    );
    expect(listHref("/tutor/homework", { view: "to-mark" })).toBe("/tutor/homework");
    expect(listHref("/tutor/homework", { view: "homework" })).toBe("/tutor/homework?view=homework");
  });

  it("parses unknown views as the queue", () => {
    expect(parseMarkingView("nope")).toBe("to-mark");
    expect(parseMarkingView("marked")).toBe("marked");
  });
});
