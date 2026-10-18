import { describe, expect, it } from "vitest";
import { withListQuery } from "./student-list";

describe("withListQuery", () => {
  it("carries the class the profile was opened from and adds extras", () => {
    const sp = new URLSearchParams("class=c1&tab=homework&q=old");
    expect(withListQuery("/tutor/students/a", sp)).toBe("/tutor/students/a?class=c1");
    expect(withListQuery("/tutor/students/a", { class: "c1" }, { tab: "notes" })).toBe(
      "/tutor/students/a?class=c1&tab=notes",
    );
    expect(withListQuery("/tutor/students/a", {}, { tab: "notes" })).toBe(
      "/tutor/students/a?tab=notes",
    );
  });
});
