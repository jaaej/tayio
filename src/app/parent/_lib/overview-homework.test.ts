import { describe, expect, it } from "vitest";
import { homeworkNeedingAttention } from "./overview-homework";

// Wednesday 14 Oct 2026; the week runs Mon 12 to Sun 18.
const today = "2026-10-14";
const hw = (id: string, due: string, status = "not_started") => ({ id, due, status });

describe("homeworkNeedingAttention", () => {
  it("lists overdue work (latest first), then work due by Sunday, soonest first", () => {
    const { items: list, moreOverdue } = homeworkNeedingAttention(
      [
        hw("sun", "2026-10-18"),
        hw("next-mon", "2026-10-19"),
        hw("late-old", "2026-09-01"),
        hw("today", "2026-10-14", "viewed"),
        hw("yesterday", "2026-10-13"),
      ],
      (r) => r.due,
      today,
    );
    expect(list.map((x) => [x.item.id, x.overdue])).toEqual([
      ["yesterday", true],
      ["late-old", true],
      ["today", false],
      ["sun", false],
    ]);
    expect(moreOverdue).toBe(0);
  });

  it("shows the three latest overdue and counts the rest", () => {
    const { items, moreOverdue } = homeworkNeedingAttention(
      ["01", "02", "03", "04", "05"].map((d) => hw(d, `2026-10-${d}`)),
      (r) => r.due,
      today,
    );
    expect(items.map((x) => x.item.id)).toEqual(["05", "04", "03"]);
    expect(moreOverdue).toBe(2);
  });

  it("leaves out handed-in work, late hand-ins included", () => {
    const { items } = homeworkNeedingAttention(
      [hw("a", "2026-10-01", "late"), hw("b", "2026-10-15", "submitted"), hw("c", "2026-10-02", "marked")],
      (r) => r.due,
      today,
    );
    expect(items).toEqual([]);
  });

  it("keeps resubmission requests in", () => {
    expect(
      homeworkNeedingAttention([hw("r", "2026-10-16", "resubmission_requested")], (r) => r.due, today).items.length,
    ).toBe(1);
  });
});
