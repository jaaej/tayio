import { describe, expect, it } from "vitest";
import {
  daysUntil,
  dueStatus,
  formatHomeworkDate,
  groupHomework,
  groupOf,
  homeworkHref,
  matchesHomework,
  parseHomeworkView,
  submissionFileName,
  type HomeworkListItem,
} from "./homework-list";

function item(over: Partial<HomeworkListItem> & { id: string }): HomeworkListItem {
  return {
    title: over.id,
    className: null,
    subjectId: null,
    subjectName: null,
    subjectYearLevel: null,
    subjectColor: null,
    status: "viewed",
    dueDate: "2026-10-16T13:00:00.000Z",
    submittedAt: null,
    markedAt: null,
    score: null,
    ...over,
  };
}

describe("groupOf", () => {
  it("treats a late submission as waiting for marking, not as overdue work", () => {
    expect(groupOf("late")).toBe("waiting");
    expect(groupOf("submitted")).toBe("waiting");
  });
  it("puts a resubmission request back in To do", () => {
    expect(groupOf("resubmission_requested")).toBe("todo");
    expect(groupOf("not_started")).toBe("todo");
    expect(groupOf("viewed")).toBe("todo");
  });
  it("groups returned work with marked work", () => {
    expect(groupOf("marked")).toBe("marked");
    expect(groupOf("returned")).toBe("marked");
  });
});

describe("groupHomework", () => {
  const items = [
    item({ id: "later", dueDate: "2026-10-20T00:00:00.000Z" }),
    item({ id: "sooner", dueDate: "2026-10-14T00:00:00.000Z" }),
    item({ id: "sub-old", status: "submitted", submittedAt: "2026-10-01T00:00:00.000Z" }),
    item({ id: "sub-new", status: "late", submittedAt: "2026-10-05T00:00:00.000Z" }),
    item({ id: "m-old", status: "marked", markedAt: "2026-09-01T00:00:00.000Z" }),
    item({ id: "m-new", status: "returned", markedAt: "2026-10-02T00:00:00.000Z" }),
  ];

  it("orders To do soonest first and the rest newest first", () => {
    const groups = groupHomework(items);
    expect(groups.map((g) => g.key)).toEqual(["todo", "waiting", "marked"]);
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([
      ["sooner", "later"],
      ["sub-new", "sub-old"],
      ["m-new", "m-old"],
    ]);
  });

  it("shows only the chosen group for a view", () => {
    expect(groupHomework(items, "submitted").map((g) => g.key)).toEqual(["waiting"]);
    expect(groupHomework(items, "marked").map((g) => g.label)).toEqual(["Marked"]);
  });

  it("leaves out empty groups", () => {
    expect(groupHomework([items[0]]).map((g) => g.key)).toEqual(["todo"]);
    expect(groupHomework([], "todo")).toEqual([]);
  });
});

describe("parseHomeworkView", () => {
  it("falls back to all for anything unknown", () => {
    expect(parseHomeworkView("todo")).toBe("todo");
    expect(parseHomeworkView("submitted")).toBe("submitted");
    expect(parseHomeworkView("bogus")).toBe("all");
    expect(parseHomeworkView(null)).toBe("all");
  });
});

describe("matchesHomework", () => {
  const row = item({ id: "x", title: "Persuasive draft", className: "Year 9", subjectName: "English" });
  it("matches title, class or subject, ignoring case", () => {
    expect(matchesHomework(row, "")).toBe(true);
    expect(matchesHomework(row, "PERSUASIVE")).toBe(true);
    expect(matchesHomework(row, "year 9")).toBe(true);
    expect(matchesHomework(row, "english")).toBe(true);
    expect(matchesHomework(row, "maths")).toBe(false);
  });
});

describe("homeworkHref", () => {
  it("carries the view and search, dropping defaults", () => {
    expect(homeworkHref("/student/homework/abc", {})).toBe("/student/homework/abc");
    expect(homeworkHref("/student/homework/abc", { view: "all", q: "" })).toBe("/student/homework/abc");
    expect(homeworkHref("/student/homework", { view: "marked", q: "week 1" })).toBe(
      "/student/homework?view=marked&q=week+1",
    );
  });
});

describe("due dates (Melbourne time)", () => {
  // Tue 13 Oct 2026, 10:00 in Melbourne (AEDT, UTC+11).
  const now = new Date("2026-10-12T23:00:00.000Z");

  it("counts Melbourne calendar days, not UTC ones", () => {
    // 23:30 Melbourne on Tue 13 Oct is still the same day.
    expect(daysUntil(new Date("2026-10-13T12:30:00.000Z"), now)).toBe(0);
    expect(daysUntil(new Date("2026-10-13T13:30:00.000Z"), now)).toBe(1);
  });

  it("words urgency without relying on colour", () => {
    expect(dueStatus(new Date("2026-10-13T12:00:00.000Z"), now)).toEqual({ label: "Due today", short: "Due today", tone: "bad" });
    expect(dueStatus(new Date("2026-10-14T06:00:00.000Z"), now)).toEqual({ label: "Due tomorrow", short: "Tomorrow", tone: "warn" });
    expect(dueStatus(new Date("2026-10-16T06:00:00.000Z"), now)).toEqual({ label: "Due in 3 days", short: "In 3 days", tone: "warn" });
    expect(dueStatus(new Date("2026-10-30T06:00:00.000Z"), now)).toEqual({ label: "Due Fri 30 Oct", short: "", tone: "muted" });
  });

  it("calls work overdue from the day after its due day, not on the day", () => {
    // Due 9 am today: past the time, but due today is not overdue.
    expect(dueStatus(new Date("2026-10-12T22:00:00.000Z"), now).label).toBe("Due today");
    expect(dueStatus(new Date("2026-10-12T06:00:00.000Z"), now).label).toBe("Overdue by 1 day");
    expect(dueStatus(new Date("2026-10-09T06:00:00.000Z"), now)).toMatchObject({
      label: "Overdue by 4 days",
      short: "Overdue",
    });
  });

  it("formats dates without the en-AU weekday comma", () => {
    expect(formatHomeworkDate(new Date("2026-10-16T06:00:00.000Z"))).toBe("Fri 16 Oct");
  });
});

describe("submissionFileName", () => {
  it("drops the folders and the upload timestamp", () => {
    expect(submissionFileName("u1/hw1/1760000000000-My_essay.pdf")).toBe("My_essay.pdf");
    expect(submissionFileName("https://x.test/a/b/notes.docx?token=1")).toBe("notes.docx");
    expect(submissionFileName("u1/hw1/")).toBe("Your file");
  });
});
