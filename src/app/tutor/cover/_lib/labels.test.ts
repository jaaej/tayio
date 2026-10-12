import { describe, expect, it } from "vitest";
import { coverUrgencyLabel, leaveDetail, leaveRangeLabel } from "./labels";

describe("leaveRangeLabel", () => {
  it("writes one day with its month", () => {
    expect(leaveRangeLabel("2026-10-15", "2026-10-15")).toBe("Thu 15 Oct");
  });

  it("names the month once for a range inside one month", () => {
    expect(leaveRangeLabel("2026-12-21", "2026-12-24")).toBe("Mon 21 – Thu 24 Dec");
  });

  it("names both months for a range across months", () => {
    expect(leaveRangeLabel("2026-12-28", "2027-01-02")).toBe("Mon 28 Dec – Sat 2 Jan");
  });
});

describe("leaveDetail", () => {
  it("counts affected classes for pending leave", () => {
    expect(
      leaveDetail({ reason: "Travel", status: "pending", affected: 1, covered: 0 }),
    ).toBe("Travel · 1 class affected");
  });

  it("counts covered classes for approved leave", () => {
    expect(
      leaveDetail({ reason: "Exams", status: "approved", affected: 4, covered: 3 }),
    ).toBe("Exams · 3 of 4 classes covered");
  });

  it("shows only the reason when nothing is affected or it was declined", () => {
    expect(
      leaveDetail({ reason: "Travel", status: "rejected", affected: 2, covered: 0 }),
    ).toBe("Travel");
    expect(
      leaveDetail({ reason: "Travel", status: "pending", affected: 0, covered: 0 }),
    ).toBe("Travel");
  });
});

describe("coverUrgencyLabel", () => {
  it("flags the 24 and 48 hour windows only", () => {
    expect(coverUrgencyLabel(10)).toBe("Under 24h");
    expect(coverUrgencyLabel(24)).toBe("Under 24h");
    expect(coverUrgencyLabel(30)).toBe("Under 48h");
    expect(coverUrgencyLabel(72)).toBeNull();
  });
});
