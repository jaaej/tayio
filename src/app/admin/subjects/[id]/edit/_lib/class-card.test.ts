import { describe, expect, it } from "vitest";
import {
  changeNotice,
  detailsPatch,
  hasStudentChanges,
  studentChanges,
  type CardDetails,
  type CardSlot,
  type CardStudent,
} from "./class-card";

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

const DETAILS: CardDetails = {
  name: "Year 9 Maths · Thursday PM",
  classType: "group",
  capacity: 8,
};

describe("detailsPatch", () => {
  it("sends nothing for an unchanged class", () => {
    expect(detailsPatch(DETAILS, { ...DETAILS })).toEqual({});
  });

  it("sends only the changed fields, trimmed", () => {
    expect(detailsPatch(DETAILS, { ...DETAILS, capacity: 6 })).toEqual({ capacity: 6 });
    expect(detailsPatch(DETAILS, { ...DETAILS, name: " Year 9 Extension ", classType: "one_on_one" })).toEqual({
      name: "Year 9 Extension",
      classType: "one_on_one",
    });
  });

  it("never blanks a saved name", () => {
    expect(detailsPatch(DETAILS, { ...DETAILS, name: "  " })).toEqual({});
  });

  it("leaves a blank name out of a new class, so it is named from its slot", () => {
    expect(detailsPatch(null, { ...DETAILS, name: "" })).toEqual({
      classType: "group",
      capacity: 8,
    });
  });
});

const student = (over: Partial<CardStudent>): CardStudent => ({
  id: "st1",
  name: "Noah Singh",
  detail: "noah@taiyo.com",
  saved: true,
  leaving: false,
  ...over,
});

describe("studentChanges", () => {
  it("has nothing to do for untouched students", () => {
    const changes = studentChanges([student({})]);
    expect(changes).toEqual({ add: [], withdraw: [] });
    expect(hasStudentChanges(changes)).toBe(false);
  });

  it("adds new students", () => {
    const changes = studentChanges([student({}), student({ id: "st2", saved: false })]);
    expect(changes).toEqual({ add: ["st2"], withdraw: [] });
    expect(hasStudentChanges(changes)).toBe(true);
  });

  it("withdraws saved students marked to leave, and drops a staged add removed again", () => {
    expect(
      studentChanges([student({ leaving: true }), student({ id: "st2", saved: false, leaving: true })]),
    ).toEqual({ add: [], withdraw: ["st1"] });
  });
});
