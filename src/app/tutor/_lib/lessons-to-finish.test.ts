import { describe, expect, it } from "vitest";
import { finishingTodo, type FinishingLesson } from "./lessons-to-finish";

const lesson = (over: Partial<FinishingLesson>): FinishingLesson => ({
  id: "l1",
  date: "2026-10-05",
  status: "upcoming",
  action: "attendance",
  classId: "c1",
  className: "Year 9 Maths · Monday PM",
  subjectName: "Year 9 Maths",
  ...over,
});

describe("finishingTodo", () => {
  it("is null with nothing to finish", () => {
    expect(finishingTodo([])).toBeNull();
  });

  it("opens the oldest lesson and asks for what it still needs", () => {
    const todo = finishingTodo([
      lesson({ id: "old", date: "2026-10-05", action: "notes" }),
      lesson({ id: "new", date: "2026-10-12", action: "attendance" }),
    ]);
    expect(todo).toEqual({
      title: "2 lessons need finishing",
      detail: "Year 9 Maths · Monday PM · Mon 5 and Mon 12 Oct",
      href: "/tutor/lessons/old",
      action: "Finish notes",
    });
  });

  it("names only the oldest once the list is long or spans classes", () => {
    const todo = finishingTodo([
      lesson({ id: "a", date: "2026-04-27" }),
      lesson({ id: "b", date: "2026-10-05", classId: "c2", className: "VCE Methods · Sunday AM", subjectName: "VCE Maths Methods" }),
    ]);
    expect(todo?.title).toBe("2 lessons need finishing");
    expect(todo?.detail).toBe("Oldest: Year 9 Maths · Monday PM, Mon 27 Apr");
    expect(todo?.action).toBe("Mark attendance");
  });

  it("says lesson in the singular", () => {
    expect(finishingTodo([lesson({})])?.title).toBe("1 lesson needs finishing");
  });
});
