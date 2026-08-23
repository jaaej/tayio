import { describe, expect, it } from "vitest";
import { parseTabParam, tabsForRole } from "./user-detail-tabs";

describe("tabsForRole", () => {
  it("gives a student their learning record", () => {
    expect(tabsForRole("student_unrestricted").map((t) => t.key)).toEqual([
      "profile",
      "lessons",
      "credits",
      "reports",
    ]);
  });

  it("applies to every student tier", () => {
    expect(tabsForRole("student_restricted").map((t) => t.key)).toEqual(
      tabsForRole("student_unrestricted").map((t) => t.key),
    );
  });

  it("gives a tutor their own sections", () => {
    expect(tabsForRole("tutor").map((t) => t.key)).toEqual([
      "profile",
      "tutor",
      "availability",
    ]);
  });

  it("gives a parent or admin a profile only, so no tab bar renders", () => {
    expect(tabsForRole("parent")).toHaveLength(1);
    expect(tabsForRole("admin_unrestricted")).toHaveLength(1);
  });
});

describe("parseTabParam", () => {
  it("defaults to profile when the param is absent", () => {
    expect(parseTabParam(undefined, "student_unrestricted")).toBe("profile");
  });

  it("accepts a tab the role actually has", () => {
    expect(parseTabParam("credits", "student_unrestricted")).toBe("credits");
    expect(parseTabParam("availability", "tutor")).toBe("availability");
  });

  it("rejects a tab belonging to a different role", () => {
    // A stale link must not render an empty panel.
    expect(parseTabParam("credits", "tutor")).toBe("profile");
    expect(parseTabParam("availability", "student_unrestricted")).toBe("profile");
  });

  it("falls back to profile on an unknown value", () => {
    expect(parseTabParam("nonsense", "tutor")).toBe("profile");
    expect(parseTabParam("", "tutor")).toBe("profile");
  });
});
