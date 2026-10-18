import { describe, expect, it } from "vitest";
import { termReportRecipients } from "./term-report-rules";

describe("termReportRecipients", () => {
  it("sends to linked parents and an unrestricted student", () => {
    expect(
      termReportRecipients({ id: "s", role: "student_unrestricted" }, ["p1", "p2"]).sort(),
    ).toEqual(["p1", "p2", "s"]);
  });

  it("leaves out a restricted student", () => {
    expect(termReportRecipients({ id: "s", role: "student_restricted" }, ["p1"])).toEqual(["p1"]);
  });

  it("has nobody for a restricted student with no parent", () => {
    expect(termReportRecipients({ id: "s", role: "student_restricted" }, [])).toEqual([]);
  });

  it("counts a parent linked twice once", () => {
    expect(termReportRecipients({ id: "s", role: "student_restricted" }, ["p1", "p1"])).toEqual(["p1"]);
  });
});
