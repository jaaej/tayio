import { describe, expect, it } from "vitest";
import { groupQuizzesBySubject, tutorQuizAction, tutorQuizBuckets } from "./quiz-list";

describe("groupQuizzesBySubject", () => {
  it("orders subjects A-Z and keeps row order inside each", () => {
    const rows = [
      { id: "1", subjectName: "Year 9 Maths" },
      { id: "2", subjectName: "VCE Maths Methods" },
      { id: "3", subjectName: "Year 9 Maths" },
    ];
    expect(groupQuizzesBySubject(rows)).toEqual([
      ["VCE Maths Methods", [{ id: "2", subjectName: "VCE Maths Methods" }]],
      [
        "Year 9 Maths",
        [
          { id: "1", subjectName: "Year 9 Maths" },
          { id: "3", subjectName: "Year 9 Maths" },
        ],
      ],
    ]);
  });
});

describe("tutorQuizBuckets", () => {
  const buckets = tutorQuizBuckets(["requested", "changes_requested"]);

  it("uses the given To do statuses", () => {
    expect(buckets[0]).toEqual({
      value: "todo",
      label: "To do",
      statuses: ["requested", "changes_requested"],
    });
  });

  it("covers every status a tutor can see exactly once", () => {
    const all = buckets.flatMap((b) => [...b.statuses]);
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(
      ["admin", "approved", "changes_requested", "pending_review", "requested"].sort(),
    );
  });
});

describe("tutorQuizAction", () => {
  it("names the next step", () => {
    expect(tutorQuizAction({ status: "changes_requested", questionCount: 8 })).toBe("Fix quiz");
    expect(tutorQuizAction({ status: "requested", questionCount: 0 })).toBe("Start quiz");
    expect(tutorQuizAction({ status: "requested", questionCount: 3 })).toBe("Continue quiz");
  });
});
