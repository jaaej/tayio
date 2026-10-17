import { describe, expect, it } from "vitest";
import { groupQuizzesBySubject } from "./quiz-list";

describe("groupQuizzesBySubject", () => {
  it("orders subjects A-Z and keeps row order inside each", () => {
    const rows = [
      { id: "1", subjectId: "y9", subjectLabel: "Year 9 Maths" },
      { id: "2", subjectId: "vce", subjectLabel: "VCE Maths Methods" },
      { id: "3", subjectId: "y9", subjectLabel: "Year 9 Maths" },
    ];
    expect(groupQuizzesBySubject(rows)).toEqual([
      { subjectId: "vce", label: "VCE Maths Methods", rows: [rows[1]] },
      { subjectId: "y9", label: "Year 9 Maths", rows: [rows[0], rows[2]] },
    ]);
  });

  it("keeps two subjects with the same name apart", () => {
    const rows = [
      { id: "1", subjectId: "a", subjectLabel: "Mathematics (Year 9)" },
      { id: "2", subjectId: "b", subjectLabel: "Mathematics (Year 10)" },
    ];
    expect(groupQuizzesBySubject(rows).map((g) => g.subjectId)).toEqual(["b", "a"]);
  });
});
