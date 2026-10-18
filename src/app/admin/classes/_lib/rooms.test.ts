import { describe, expect, it } from "vitest";
import { roomChoices, roomsInUse } from "./rooms";

describe("roomsInUse", () => {
  it("lists each room once, trimmed, in natural order", () => {
    expect(roomsInUse(["Room 10", " Room 2", "Room 2", null, "", "  ", "Room 1"])).toEqual([
      "Room 1",
      "Room 2",
      "Room 10",
    ]);
  });
});

describe("roomChoices", () => {
  it("offers Online once, after the rooms in use", () => {
    expect(roomChoices(["Room 2", "online", null])).toEqual(["Room 2", "Online"]);
    expect(roomChoices([])).toEqual(["Online"]);
  });
});
