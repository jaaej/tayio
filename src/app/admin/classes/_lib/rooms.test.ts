import { describe, expect, it } from "vitest";
import { roomChoices, roomTaken, roomsInUse, type RoomSlot } from "./rooms";

const THU: RoomSlot = { weekday: 4, startTime: "16:00", endTime: "17:00" };

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

describe("roomTaken", () => {
  const others = [
    { weekday: 4, startTime: "16:30:00", endTime: "17:30:00", room: "room 1" },
    { weekday: 5, startTime: "16:00:00", endTime: "17:00:00", room: "Room 3" },
  ];

  it("flags a room another class uses at an overlapping time", () => {
    expect(roomTaken("Room 1", THU, others)).toBe(true);
  });

  it("ignores other days, touching times and Online", () => {
    expect(roomTaken("Room 3", THU, others)).toBe(false);
    expect(roomTaken("Room 1", { ...THU, startTime: "15:00", endTime: "16:30" }, others)).toBe(false);
    expect(roomTaken("Online", THU, [{ ...others[0], room: "Online" }])).toBe(false);
  });

  it("cannot clash without a day and time", () => {
    expect(roomTaken("Room 1", { ...THU, weekday: null }, others)).toBe(false);
  });
});
