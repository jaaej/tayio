import { describe, expect, it } from "vitest";
import { pickSelectedChild, withChild } from "./parent-child";

const kids = [{ id: "noah" }, { id: "sarah" }];

describe("pickSelectedChild", () => {
  it("prefers the child asked for, then the remembered one, then the first", () => {
    expect(pickSelectedChild(kids, "sarah", "noah")?.id).toBe("sarah");
    expect(pickSelectedChild(kids, undefined, "sarah")?.id).toBe("sarah");
    expect(pickSelectedChild(kids, undefined, undefined)?.id).toBe("noah");
  });

  it("never picks a child who is not linked", () => {
    expect(pickSelectedChild(kids, "stranger", "other")?.id).toBe("noah");
    expect(pickSelectedChild([], "sarah", "sarah")).toBeNull();
  });
});

describe("withChild", () => {
  it("adds the child to a link with or without a query", () => {
    expect(withChild("/parent/timetable", "s1")).toBe("/parent/timetable?child=s1");
    expect(withChild("/parent/timetable?month=2026-10", "s1")).toBe("/parent/timetable?month=2026-10&child=s1");
  });
});
