import { describe, expect, it } from "vitest";
import { cancelCreditExpiry, cancelRefusal, creditTermFor } from "./lesson-cancel-rules";

describe("cancelCreditExpiry", () => {
  it("lasts to the end of the term", () => {
    expect(cancelCreditExpiry("2026-11-22", "2026-10-24")).toBe("2026-11-22");
  });
  it("lasts at least four weeks after a late cancellation", () => {
    expect(cancelCreditExpiry("2026-11-22", "2026-11-14")).toBe("2026-12-12");
  });
});

describe("creditTermFor", () => {
  const T3 = { id: "t3", startDate: "2026-07-13", endDate: "2026-09-18" };
  const T4 = { id: "t4", startDate: "2026-10-12", endDate: "2026-11-22" };
  it("takes the lesson's term", () => {
    expect(creditTermFor([T3, T4], "2026-10-24")?.id).toBe("t4");
  });
  it("takes the next term for a lesson in the holidays", () => {
    expect(creditTermFor([T4, T3], "2026-09-30")?.id).toBe("t4");
  });
  it("is nothing after the last term", () => {
    expect(creditTermFor([T3, T4], "2026-12-10")).toBeNull();
  });
});

describe("cancelRefusal", () => {
  it("cancels a lesson nobody has marked", () => {
    expect(cancelRefusal({ status: "upcoming", marks: [], notes: 0 })).toBeNull();
  });
  it("ignores bookings and moves written ahead", () => {
    expect(cancelRefusal({ status: "upcoming", marks: ["makeup_attended", "absent"], notes: 0 })).toBeNull();
  });
  it("keeps a lesson someone taught", () => {
    expect(cancelRefusal({ status: "upcoming", marks: ["present"], notes: 0 })).toMatch(/Someone taught/);
    expect(cancelRefusal({ status: "upcoming", marks: [], notes: 1 })).toMatch(/Someone taught/);
  });
  it("refuses a lesson that isn't running", () => {
    expect(cancelRefusal({ status: "cancelled", marks: [], notes: 0 })).toMatch(/already cancelled/);
    expect(cancelRefusal({ status: "rescheduled", marks: [], notes: 0 })).toMatch(/moved/);
  });
});
