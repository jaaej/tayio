import { describe, expect, it } from "vitest";
import { groupQuizzesBySubject } from "./quiz-list";

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
