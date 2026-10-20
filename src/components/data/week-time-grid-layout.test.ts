import { describe, expect, it } from "vitest";
import { countLabel, fullDayDiffers, gridHours, placeDay } from "./week-time-grid-layout";

const at = (startTime: string, endTime: string, id = `${startTime}-${endTime}`) => ({ id, startTime, endTime });

describe("gridHours", () => {
  it("fits an hour either side of the week's lessons", () => {
    expect(gridHours([at("16:30", "18:30"), at("19:00", "21:00")], false)).toEqual({ start: 15, end: 22 });
  });

  it("shows the full day widened to fit the lessons", () => {
    expect(gridHours([at("16:30", "18:30")], true)).toEqual({ start: 8, end: 21 });
    expect(gridHours([at("07:30", "08:30"), at("20:00", "22:00")], true)).toEqual({ start: 6, end: 23 });
  });

  it("stays inside midnight to midnight", () => {
    expect(gridHours([at("00:30", "01:00"), at("23:00", "23:59")], false)).toEqual({ start: 0, end: 24 });
  });

  it("shows the full day for a week with no lessons", () => {
    expect(gridHours([], false)).toEqual({ start: 8, end: 21 });
    expect(fullDayDiffers([])).toBe(false);
  });

  it("knows when the full day adds nothing", () => {
    expect(fullDayDiffers([at("16:30", "18:30")])).toBe(true);
    expect(fullDayDiffers([at("07:00", "20:30")])).toBe(false);
  });
});

describe("placeDay", () => {
  it("gives a lone lesson the whole column", () => {
    expect(placeDay([at("19:00", "21:00")])).toEqual([
      expect.objectContaining({ kind: "event", lane: 0, lanes: 1, start: 1140, end: 1260 }),
    ]);
  });

  it("puts two lessons at the same time side by side", () => {
    const placed = placeDay([at("16:30", "18:30", "a"), at("16:30", "18:30", "b")]);
    expect(placed.map((p) => p.kind === "event" && [p.event.id, p.lane, p.lanes])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
    ]);
  });

  it("folds three or more lessons at once into one card, the next lessons kept apart", () => {
    const placed = placeDay([
      at("16:30", "18:30", "a"),
      at("16:30", "18:30", "b"),
      at("16:30", "17:30", "c"),
      at("19:00", "21:00", "d"),
    ]);
    expect(placed).toHaveLength(2);
    expect(placed[0]).toMatchObject({ kind: "group", start: 990, end: 1110, nextStart: 1140 });
    expect(placed[0].kind === "group" && placed[0].events.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(placed[1]).toMatchObject({ kind: "event", lane: 0, lanes: 1 });
  });

  it("keeps a chain of lessons that never meet three at once side by side", () => {
    const placed = placeDay([at("16:00", "17:00", "a"), at("16:30", "17:30", "b"), at("17:00", "18:00", "c")]);
    expect(placed.every((p) => p.kind === "event" && p.lanes === 2)).toBe(true);
  });

  it("starts a new cluster when a lesson begins as another ends", () => {
    const placed = placeDay([at("16:00", "17:00", "a"), at("17:00", "18:00", "b")]);
    expect(placed.map((p) => p.kind === "event" && p.lanes)).toEqual([1, 1]);
  });
});

describe("countLabel", () => {
  it("pluralises the noun", () => {
    expect(countLabel(1, "class")).toBe("1 class");
    expect(countLabel(3, "class")).toBe("3 classes");
    expect(countLabel(2, "lesson")).toBe("2 lessons");
  });
});
