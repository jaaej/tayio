import { describe, expect, it } from "vitest";
import {
  changeNotice,
  detailsPatch,
  hasStudentChanges,
  roomTaken,
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

const DETAILS: CardDetails = {
  name: "Year 9 Maths · Thursday PM",
  subjectId: "s1",
  classType: "group",
  capacity: 8,
  onlineLink: "",
};

describe("detailsPatch", () => {
  it("sends nothing for an unchanged class", () => {
    expect(detailsPatch(DETAILS, { ...DETAILS })).toEqual({});
  });

  it("sends only the changed fields, trimmed", () => {
    expect(
      detailsPatch(DETAILS, { ...DETAILS, capacity: 6, onlineLink: " https://meet.example/x " }),
    ).toEqual({ capacity: 6, onlineLink: "https://meet.example/x" });
    expect(detailsPatch(DETAILS, { ...DETAILS, subjectId: "s2", classType: "one_on_one" })).toEqual({
      subjectId: "s2",
      classType: "one_on_one",
    });
  });

  it("clears a saved link but never blanks a saved name", () => {
    const saved = { ...DETAILS, onlineLink: "https://meet.example/x" };
    expect(detailsPatch(saved, { ...saved, onlineLink: "", name: "  " })).toEqual({ onlineLink: "" });
  });

  it("leaves a blank name and link out of a new class, so it is named from its slot", () => {
    expect(detailsPatch(null, { ...DETAILS, name: "" })).toEqual({
      subjectId: "s1",
      classType: "group",
      capacity: 8,
    });
  });
});

const student = (over: Partial<CardStudent>): CardStudent => ({
  id: "st1",
  name: "Noah Singh",
  detail: "noah@taiyo.com",
  saved: { deliveryMode: null, adminNotes: "" },
  deliveryMode: null,
  adminNotes: "",
  leaving: false,
  ...over,
});

describe("studentChanges", () => {
  it("has nothing to do for untouched students", () => {
    const changes = studentChanges([student({})]);
    expect(changes).toEqual({ add: [], withdraw: [], updates: [] });
    expect(hasStudentChanges(changes)).toBe(false);
  });

  it("adds new students with their delivery mode and note", () => {
    expect(
      studentChanges([student({ id: "st2", saved: null, deliveryMode: "online", adminNotes: " Needs a laptop " })]),
    ).toEqual({
      add: ["st2"],
      withdraw: [],
      updates: [{ studentId: "st2", deliveryMode: "online", adminNotes: "Needs a laptop" }],
    });
  });

  it("withdraws saved students marked to leave, and drops a staged add removed again", () => {
    expect(
      studentChanges([student({ leaving: true }), student({ id: "st2", saved: null, leaving: true })]),
    ).toEqual({ add: [], withdraw: ["st1"], updates: [] });
  });

  it("updates only what changed on a saved enrolment", () => {
    const saved = { deliveryMode: "in_person" as const, adminNotes: "Old note" };
    expect(studentChanges([student({ saved, deliveryMode: null, adminNotes: "Old note " })])).toEqual({
      add: [],
      withdraw: [],
      updates: [{ studentId: "st1", deliveryMode: null }],
    });
  });
});
