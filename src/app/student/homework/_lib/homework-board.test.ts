import { describe, expect, it } from "vitest";
import {
  boardHref,
  boardSubjects,
  buildDoneBoard,
  buildTodoBoard,
  overdueAge,
  parseBoardParams,
  soleTutor,
} from "./homework-board";
import type { HomeworkListItem } from "./homework-list";

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

// Tue 13 Oct 2026, 2 pm in Melbourne (AEDT, UTC+11).
const NOW = new Date("2026-10-13T03:00:00.000Z");
const params = parseBoardParams({});

describe("parseBoardParams", () => {
  it("defaults to to-do, no subject, no search, recent overdue only", () => {
    expect(params).toEqual({ subject: null, show: "todo", q: "", older: false });
  });
  it("reads done, a subject, a trimmed search and all overdue", () => {
    expect(parseBoardParams({ show: "done", subject: "Maths", q: "  set ", older: "1" })).toEqual({
      subject: "Maths",
      show: "done",
      q: "set",
      older: true,
    });
  });
  it("ignores unknown values", () => {
    expect(parseBoardParams({ show: "nope", older: "yes" })).toMatchObject({ show: "todo", older: false });
  });
});

describe("boardHref", () => {
  it("leaves defaults out of the URL", () => {
    expect(boardHref("/student/homework", params)).toBe("/student/homework");
  });
  it("carries the filters", () => {
    expect(boardHref("/student/homework/1", { subject: "Year 9 Maths", show: "done", q: "x" })).toBe(
      "/student/homework/1?subject=Year+9+Maths&show=done&q=x",
    );
  });
});

describe("boardSubjects", () => {
  it("lists each subject once, alphabetically, skipping independent tasks", () => {
    const items = [
      item({ id: "a", subjectId: "m", subjectName: "Maths" }),
      item({ id: "b", subjectId: "e", subjectName: "English" }),
      item({ id: "c", subjectId: "m", subjectName: "Maths" }),
      item({ id: "d" }),
    ];
    expect(boardSubjects(items).map((s) => [s.id, s.label])).toEqual([
      ["e", "English"],
      ["m", "Maths"],
    ]);
  });

  it("keeps two subjects with the same name apart, labelled by level", () => {
    const items = [
      item({ id: "a", subjectId: "m9", subjectName: "Mathematics", subjectYearLevel: "Year 9" }),
      item({ id: "b", subjectId: "m10", subjectName: "Mathematics", subjectYearLevel: "Year 10" }),
    ];
    expect(boardSubjects(items).map((s) => [s.id, s.label])).toEqual([
      ["m10", "Mathematics (Year 10)"],
      ["m9", "Mathematics (Year 9)"],
    ]);
  });
});

describe("buildTodoBoard", () => {
  const items = [
    item({ id: "sat", dueDate: "2026-10-17T12:00:00.000Z" }),
    item({ id: "fri", dueDate: "2026-10-16T12:00:00.000Z" }),
    // Sunday 18 Oct, 11 pm Melbourne: still this week.
    item({ id: "sun", dueDate: "2026-10-18T12:00:00.000Z" }),
    // Monday 19 Oct: next week.
    item({ id: "mon", dueDate: "2026-10-19T02:00:00.000Z" }),
    item({ id: "thu-next", dueDate: "2026-10-22T02:00:00.000Z" }),
    // Earlier today: past the due time, so overdue.
    item({ id: "this-morning", dueDate: "2026-10-12T22:00:00.000Z" }),
    item({ id: "old", dueDate: "2026-08-01T02:00:00.000Z" }),
    item({ id: "handed-in", status: "submitted", dueDate: "2026-10-16T12:00:00.000Z" }),
    item({ id: "resubmit", status: "resubmission_requested", dueDate: "2026-10-15T12:00:00.000Z" }),
  ];

  it("splits open work by the Melbourne week and orders each part", () => {
    const board = buildTodoBoard(items, params, NOW);
    expect(board.dueThisWeek.map((i) => i.id)).toEqual(["resubmit", "fri", "sat", "sun"]);
    expect(board.comingUp.map((i) => i.id)).toEqual(["mon", "thu-next"]);
    expect(board.overdue.map((i) => i.id)).toEqual(["this-morning", "old"]);
  });

  it("on a Sunday, this week is only the rest of today", () => {
    const sunday = new Date("2026-10-18T01:00:00.000Z");
    const board = buildTodoBoard(items, params, sunday);
    expect(board.dueThisWeek.map((i) => i.id)).toEqual(["sun"]);
    expect(board.comingUp.map((i) => i.id)).toEqual(["mon", "thu-next"]);
  });

  it("filters by subject and search", () => {
    const mixed = [
      item({ id: "m", title: "Graphing", subjectId: "s-m", subjectName: "Maths" }),
      item({ id: "e", title: "Speech", subjectId: "s-e", subjectName: "English" }),
    ];
    expect(buildTodoBoard(mixed, { ...params, subject: "s-m" }, NOW).dueThisWeek.map((i) => i.id)).toEqual(["m"]);
    expect(buildTodoBoard(mixed, { ...params, q: "spee" }, NOW).dueThisWeek.map((i) => i.id)).toEqual(["e"]);
  });
});

describe("buildDoneBoard", () => {
  it("splits handed-in work from marked work, newest first", () => {
    const board = buildDoneBoard(
      [
        item({ id: "open" }),
        item({ id: "s-old", status: "submitted", submittedAt: "2026-10-01T00:00:00.000Z" }),
        item({ id: "s-new", status: "late", submittedAt: "2026-10-05T00:00:00.000Z" }),
        item({ id: "m-old", status: "marked", markedAt: "2026-09-01T00:00:00.000Z" }),
        item({ id: "m-new", status: "returned", markedAt: "2026-10-02T00:00:00.000Z" }),
      ],
      params,
    );
    expect(board.waiting.map((i) => i.id)).toEqual(["s-new", "s-old"]);
    expect(board.marked.map((i) => i.id)).toEqual(["m-new", "m-old"]);
  });
});

describe("overdueAge", () => {
  it("says today, days under two weeks, then whole weeks", () => {
    expect(overdueAge(new Date("2026-10-12T22:00:00.000Z"), NOW)).toBe("Today");
    expect(overdueAge(new Date("2026-10-12T02:00:00.000Z"), NOW)).toBe("1 day");
    expect(overdueAge(new Date("2026-10-03T02:00:00.000Z"), NOW)).toBe("10 days");
    expect(overdueAge(new Date("2026-08-04T02:00:00.000Z"), NOW)).toBe("10 weeks");
  });
});

describe("soleTutor", () => {
  it("names the tutor when every item has the same one", () => {
    expect(
      soleTutor([
        { tutorId: "t1", tutorFirstName: "Tom" },
        { tutorId: "t1", tutorFirstName: "Tom" },
        { tutorId: null, tutorFirstName: null },
      ]),
    ).toEqual({ id: "t1", firstName: "Tom" });
  });
  it("is null with several tutors or none", () => {
    expect(
      soleTutor([
        { tutorId: "t1", tutorFirstName: "Tom" },
        { tutorId: "t2", tutorFirstName: "Ana" },
      ]),
    ).toBeNull();
    expect(soleTutor([{ tutorId: null, tutorFirstName: null }])).toBeNull();
  });
});
