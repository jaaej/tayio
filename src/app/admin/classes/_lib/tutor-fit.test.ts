import { describe, expect, it } from "vitest";
import { rankTutorsForSlot, type TutorClassSlot, type TutorWeeklyWindow } from "./tutor-fit";

const tutors = [
  { id: "zoe", firstName: "Zoe", lastName: "Free" },
  { id: "amy", firstName: "Amy", lastName: "Outside" },
  { id: "bob", firstName: "Bob", lastName: "Busy" },
  { id: "cal", firstName: "Cal", lastName: "Nohours" },
  { id: "ann", firstName: "Ann", lastName: "Free" },
];

// Tuesday (2), 4 to 6 pm.
const windows: TutorWeeklyWindow[] = [
  { tutorId: "zoe", weekday: 2, startTime: "15:00:00", endTime: "19:00:00", subjectId: null },
  // Ann's Tuesday is two touching windows that together cover the class.
  { tutorId: "ann", weekday: 2, startTime: "16:00:00", endTime: "17:00:00", subjectId: null },
  { tutorId: "ann", weekday: 2, startTime: "17:00:00", endTime: "18:00:00", subjectId: null },
  { tutorId: "amy", weekday: 2, startTime: "16:00:00", endTime: "17:00:00", subjectId: null },
  { tutorId: "amy", weekday: 3, startTime: "16:00:00", endTime: "18:00:00", subjectId: null },
  { tutorId: "bob", weekday: 2, startTime: "14:00:00", endTime: "20:00:00", subjectId: null },
];

const classSlots: TutorClassSlot[] = [
  { tutorId: "bob", name: "Year 9 Maths", weekday: 2, startTime: "17:30:00", endTime: "18:30:00" },
  // Touching (ends as the new class starts) is not a clash.
  { tutorId: "zoe", name: "Year 7 English", weekday: 2, startTime: "15:00:00", endTime: "16:00:00" },
];

const slot = { weekday: 2, startTime: "16:00", endTime: "18:00", subjectId: null };

describe("rankTutorsForSlot", () => {
  it("lists free tutors first, then busy, then outside their hours, alphabetical within each", () => {
    const ranked = rankTutorsForSlot(tutors, windows, classSlots, slot);
    expect(ranked.map((t) => [t.name, t.fit, t.note])).toEqual([
      ["Ann Free", "free", null],
      ["Zoe Free", "free", null],
      ["Bob Busy", "busy", "Teaching Year 9 Maths then"],
      ["Amy Outside", "outside", "Outside their available hours"],
      ["Cal Nohours", "outside", "No available hours set"],
    ]);
  });

  it("only counts subject-scoped availability for that subject", () => {
    const scoped: TutorWeeklyWindow[] = [
      { tutorId: "amy", weekday: 2, startTime: "16:00:00", endTime: "18:00:00", subjectId: "english" },
    ];
    const fit = (subjectId: string | null) =>
      rankTutorsForSlot([tutors[1]], scoped, [], { ...slot, subjectId })[0].fit;
    expect(fit("english")).toBe("free");
    expect(fit("maths")).toBe("outside");
    // Before a subject is chosen, any availability counts.
    expect(fit(null)).toBe("free");
  });

  it("is alphabetical with no notes until a day and a valid time range are set", () => {
    for (const s of [
      { ...slot, weekday: null },
      { ...slot, endTime: "15:00" },
      { ...slot, startTime: null },
    ]) {
      const ranked = rankTutorsForSlot(tutors, windows, classSlots, s);
      expect(ranked.map((t) => t.name)).toEqual(["Amy Outside", "Ann Free", "Bob Busy", "Cal Nohours", "Zoe Free"]);
      expect(ranked.every((t) => t.fit === "unknown" && t.note === null)).toBe(true);
    }
  });
});
