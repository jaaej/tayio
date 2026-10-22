import { describe, expect, it } from "vitest";
import {
  countLabel,
  fullDayDiffers,
  gridHours,
  groupCardHeight,
  hourPxFor,
  placeDay,
} from "./week-time-grid-layout";

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

describe("groupCardHeight", () => {
  it("adds a row per lesson and a time label per later start", () => {
    const together = [at("16:30", "18:30", "a"), at("16:30", "18:30", "b"), at("16:30", "18:30", "c")];
    expect(groupCardHeight(together)).toBe(14 + 24 + 3 * 26 + 2 * 2);
    expect(groupCardHeight([...together, at("17:45", "19:15", "d")])).toBe(14 + 24 + 4 * 26 + 3 * 2 + 20);
  });
});

describe("hourPxFor", () => {
  // Production's week of 19 October 2026: three classes at 4:30 with the
  // next class at 7 pm (Tuesday) and 6:30 pm (Thursday).
  const tuesday = placeDay([
    at("16:30", "18:30", "a"),
    at("16:30", "18:30", "b"),
    at("16:30", "18:30", "c"),
    at("19:00", "21:00", "d"),
  ]);
  const thursday = placeDay([
    at("16:30", "18:30", "e"),
    at("16:30", "18:30", "f"),
    at("16:30", "18:30", "g"),
    at("18:30", "20:30", "h"),
  ]);

  it("keeps the base when every card fits", () => {
    expect(hourPxFor([placeDay([at("16:30", "18:30"), at("19:00", "21:00")])], 22, 42)).toBe(42);
    // The last card of a day may run on to the end of the grid.
    expect(hourPxFor([placeDay([at("16:30", "18:30", "a"), at("16:30", "18:30", "b"), at("16:30", "18:30", "c")])], 22, 42)).toBe(42);
  });

  it("grows so each card ends above the day's next lessons", () => {
    // 126px of card and margin in 2.5 hours, then in 2 hours.
    expect(hourPxFor([tuesday], 22, 42)).toBe(51);
    expect(hourPxFor([tuesday, thursday], 22, 42)).toBe(63);
    expect(hourPxFor([tuesday, thursday], 22, 104)).toBe(104);
  });

  it("grows at most threefold", () => {
    const crowded = placeDay([
      ...["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => at("16:00", "17:00", id)),
      at("17:00", "18:00", "i"),
    ]);
    expect(hourPxFor([crowded], 22, 42)).toBe(126);
  });
});

describe("countLabel", () => {
  it("pluralises the noun", () => {
    expect(countLabel(1, "class")).toBe("1 class");
    expect(countLabel(3, "class")).toBe("3 classes");
    expect(countLabel(2, "lesson")).toBe("2 lessons");
  });
});
