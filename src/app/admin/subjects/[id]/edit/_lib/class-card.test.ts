import { describe, expect, it } from "vitest";
import { changeNotice, roomTaken, type CardSlot } from "./class-card";

const THU: CardSlot = { weekday: 4, startTime: "16:00", endTime: "17:00", room: "Room 2", tutorId: "t1" };
const people = { tutorName: "Tom Tutor", oldTutorName: "Tom Tutor", students: 6, parents: 5 };

describe("changeNotice", () => {
  it("matches the handoff for a room change", () => {
    expect(changeNotice(THU, { ...THU, room: "Room 3" }, people)).toBe(
      "Room changed from Room 2. Saving tells Tom Tutor, 6 students and 5 parents.",
    );
  });

  it("names the old day and time when they change", () => {
    expect(changeNotice(THU, { ...THU, weekday: 2 }, people)).toBe(
      "Time changed from Thursday 4:00 – 5:00 pm. Saving tells Tom Tutor, 6 students and 5 parents.",
    );
    expect(changeNotice(THU, { ...THU, weekday: 2, room: "Room 3" }, people)).toBe(
      "Time and room changed from Thursday 4:00 – 5:00 pm, Room 2. Saving tells Tom Tutor, 6 students and 5 parents.",
    );
  });

  it("is quiet when nothing a family sees changed", () => {
    expect(changeNotice(THU, { ...THU, startTime: "16:00:00" }, people)).toBeNull();
    expect(changeNotice(THU, { ...THU, room: " Room 2 " }, people)).toBeNull();
  });

  it("only names who is actually told", () => {
    expect(
      changeNotice(THU, { ...THU, room: "Room 3" }, { ...people, students: 1, parents: 0 }),
    ).toBe("Room changed from Room 2. Saving tells Tom Tutor and 1 student.");
    expect(
      changeNotice({ ...THU, room: "" }, THU, { ...people, students: 0, parents: 0 }),
    ).toBe("Room set to Room 2. Saving tells Tom Tutor.");
  });

  it("tells both tutors about a new tutor", () => {
    expect(
      changeNotice(THU, { ...THU, tutorId: "t2" }, { ...people, tutorName: "Hana Park" }),
    ).toBe("Tutor changed from Tom Tutor. Saving tells Hana Park and Tom Tutor.");
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
