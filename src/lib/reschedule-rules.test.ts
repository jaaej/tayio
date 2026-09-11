import { describe, expect, it } from "vitest";
import { isCompatibleRescheduleTarget } from "./reschedule-rules";

describe("isCompatibleRescheduleTarget", () => {
  it("accepts the same subject and year", () => {
    expect(
      isCompatibleRescheduleTarget(
        { subjectId: "maths-10", subjectYearLevel: "10" },
        { subjectId: "maths-10", subjectYearLevel: "10" },
      ),
    ).toBe(true);
  });

  it("rejects a different subject even when the year matches", () => {
    expect(
      isCompatibleRescheduleTarget(
        { subjectId: "english-10", subjectYearLevel: "10" },
        { subjectId: "maths-10", subjectYearLevel: "10" },
      ),
    ).toBe(false);
  });

  it("rejects a different year and normalises harmless formatting", () => {
    expect(
      isCompatibleRescheduleTarget(
        { subjectId: "maths", subjectYearLevel: " Year 10 " },
        { subjectId: "maths", subjectYearLevel: "year 10" },
      ),
    ).toBe(true);
    expect(
      isCompatibleRescheduleTarget(
        { subjectId: "maths", subjectYearLevel: "Year 10" },
        { subjectId: "maths", subjectYearLevel: "Year 11" },
      ),
    ).toBe(false);
  });
});
