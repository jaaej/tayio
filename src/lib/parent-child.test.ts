import { describe, expect, it } from "vitest";
import { forParent, pickSelectedChild, withChild } from "./parent-child";

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

describe("forParent", () => {
  it("leads with the children the notification is about", () => {
    expect(forParent(["Sarah"], "Year 9 Maths · Thu")).toBe("Sarah · Year 9 Maths · Thu");
    expect(forParent(["Sarah", "Leo"], "Year 9 Maths")).toBe("Sarah and Leo · Year 9 Maths");
    expect(forParent(["Ana", "Sarah", "Leo"], "X")).toBe("Ana, Sarah and Leo · X");
  });

  it("leaves the body alone without a name", () => {
    expect(forParent([], "Year 9 Maths")).toBe("Year 9 Maths");
  });
});
