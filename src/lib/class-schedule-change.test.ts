import { describe, expect, it } from "vitest";
import {
  classChangeTitle,
  classMoveSentence,
  slotClassName,
  planClassScheduleChange,
  slotChangeSummary,
  weeklySlotLabel,
  type ClassSlot,
  type SlotLesson,
} from "./class-schedule-change";

// Thursday 15 October 2026, 10:00 in Melbourne (AEDT, UTC+11).
const NOW = new Date("2026-10-14T23:00:00Z");

const MONDAY_4PM: ClassSlot = {
  tutorId: "tutor-a",
  isRecurring: true,
  weekday: 1,
  startTime: "16:00:00",
  endTime: "17:00:00",
  location: "Room 9",
};

function lesson(over: Partial<SlotLesson> & Pick<SlotLesson, "id" | "date">): SlotLesson {
  return {
    startTime: "16:00:00",
    endTime: "17:00:00",
    tutorId: "tutor-a",
    location: "Room 9",
    hasDependents: false,
    ...over,
  };
}

const MONDAYS = [
  lesson({ id: "l1", date: "2026-10-19" }),
  lesson({ id: "l2", date: "2026-10-26" }),
];

describe("planClassScheduleChange", () => {
  it("does nothing when nothing changed", () => {
    expect(
      planClassScheduleChange({ before: MONDAY_4PM, after: MONDAY_4PM, lessons: MONDAYS, now: NOW }),
    ).toEqual({ updates: [], deletes: [] });
  });

  it("moves each weekly lesson to the new day in the same week, at the new time", () => {
    const plan = planClassScheduleChange({
      before: MONDAY_4PM,
      after: { ...MONDAY_4PM, weekday: 2, startTime: "17:00", endTime: "18:00" },
      lessons: MONDAYS,
      now: NOW,
    });
    expect(plan.deletes).toEqual([]);
    expect(plan.updates).toEqual([
      { id: "l1", set: { date: "2026-10-20", startTime: "17:00:00", endTime: "18:00:00" } },
      { id: "l2", set: { date: "2026-10-27", startTime: "17:00:00", endTime: "18:00:00" } },
    ]);
  });

  it("moves Sunday to the end of the same Monday-first week", () => {
    const plan = planClassScheduleChange({
      before: MONDAY_4PM,
      after: { ...MONDAY_4PM, weekday: 0 },
      lessons: [MONDAYS[0]],
      now: NOW,
    });
    expect(plan.updates).toEqual([{ id: "l1", set: { date: "2026-10-25" } }]);
  });

  it("removes a lesson whose new day this week has already passed", () => {
    // Saturday 17 October moved to Wednesday: that Wednesday was yesterday.
    const plan = planClassScheduleChange({
      before: { ...MONDAY_4PM, weekday: 6 },
      after: { ...MONDAY_4PM, weekday: 3 },
      lessons: [lesson({ id: "sat", date: "2026-10-17" }), lesson({ id: "sat2", date: "2026-10-24" })],
      now: NOW,
    });
    expect(plan.deletes).toEqual(["sat"]);
    expect(plan.updates).toEqual([{ id: "sat2", set: { date: "2026-10-21" } }]);
  });

  it("keeps a passed lesson that a student has booked into, unchanged", () => {
    const plan = planClassScheduleChange({
      before: { ...MONDAY_4PM, weekday: 6 },
      after: { ...MONDAY_4PM, weekday: 3 },
      lessons: [lesson({ id: "sat", date: "2026-10-17", hasDependents: true })],
      now: NOW,
    });
    expect(plan).toEqual({ updates: [], deletes: [] });
  });

  it("treats today's lesson as passed once the new start time has gone", () => {
    // Today is Thursday 10:00. Moving a Friday lesson to Thursday 9:00 is too late.
    const plan = planClassScheduleChange({
      before: { ...MONDAY_4PM, weekday: 5 },
      after: { ...MONDAY_4PM, weekday: 4, startTime: "09:00", endTime: "10:00" },
      lessons: [lesson({ id: "fri", date: "2026-10-16" })],
      now: NOW,
    });
    expect(plan.deletes).toEqual(["fri"]);
  });

  it("clears out duplicates left in one week by an older edit", () => {
    // The old bug left both Monday and Tuesday lessons; the class is Tuesday now.
    const plan = planClassScheduleChange({
      before: { ...MONDAY_4PM, weekday: 2 },
      after: { ...MONDAY_4PM, weekday: 2 },
      lessons: [
        lesson({ id: "mon", date: "2026-10-19" }),
        lesson({ id: "tue", date: "2026-10-20" }),
      ],
      now: NOW,
    });
    expect(plan).toEqual({ updates: [], deletes: ["mon"] });
  });

  it("keeps the real weekly lesson over an older edit's leftover, with the new room", () => {
    // Found in the browser: the class was Tuesday 5pm Room 2 with Monday
    // leftovers in Room 9, then moved to Wednesday 3pm Room 3.
    const before = { ...MONDAY_4PM, weekday: 2, startTime: "17:00", endTime: "18:00", location: "Room 2" };
    const plan = planClassScheduleChange({
      before,
      after: { ...before, weekday: 3, startTime: "15:00", endTime: "16:00", location: "Room 3" },
      lessons: [
        lesson({ id: "mon", date: "2026-10-19", location: "Room 9" }),
        lesson({ id: "tue", date: "2026-10-20", startTime: "17:00:00", endTime: "18:00:00", location: "Room 2" }),
      ],
      now: NOW,
    });
    expect(plan).toEqual({
      updates: [
        {
          id: "tue",
          set: { date: "2026-10-21", startTime: "15:00:00", endTime: "16:00:00", location: "Room 3" },
        },
      ],
      deletes: ["mon"],
    });
  });

  it("keeps the booked one of two duplicates and moves it to the slot", () => {
    const plan = planClassScheduleChange({
      before: { ...MONDAY_4PM, weekday: 2 },
      after: { ...MONDAY_4PM, weekday: 2 },
      lessons: [
        lesson({ id: "mon", date: "2026-10-19", hasDependents: true }),
        lesson({ id: "tue", date: "2026-10-20" }),
      ],
      now: NOW,
    });
    expect(plan).toEqual({
      updates: [{ id: "mon", set: { date: "2026-10-20" } }],
      deletes: ["tue"],
    });
  });

  it("removes unbooked weekly lessons when the class stops repeating", () => {
    const plan = planClassScheduleChange({
      before: MONDAY_4PM,
      after: { ...MONDAY_4PM, isRecurring: false },
      lessons: [MONDAYS[0], { ...MONDAYS[1], hasDependents: true }],
      now: NOW,
    });
    expect(plan).toEqual({ updates: [], deletes: ["l1"] });
  });

  it("removes unbooked weekly lessons when the day is cleared", () => {
    const plan = planClassScheduleChange({
      before: MONDAY_4PM,
      after: { ...MONDAY_4PM, weekday: null },
      lessons: MONDAYS,
      now: NOW,
    });
    expect(plan.deletes).toEqual(["l1", "l2"]);
  });

  it("hands lessons to the new tutor but leaves covered lessons with their cover tutor", () => {
    const plan = planClassScheduleChange({
      before: MONDAY_4PM,
      after: { ...MONDAY_4PM, tutorId: "tutor-b" },
      lessons: [MONDAYS[0], { ...MONDAYS[1], tutorId: "cover-tutor" }],
      now: NOW,
    });
    expect(plan.updates).toEqual([{ id: "l1", set: { tutorId: "tutor-b" } }]);
  });

  it("moves lessons to the new room unless a lesson was given its own room", () => {
    const plan = planClassScheduleChange({
      before: MONDAY_4PM,
      after: { ...MONDAY_4PM, location: "Room 2" },
      lessons: [MONDAYS[0], { ...MONDAYS[1], location: "Library" }],
      now: NOW,
    });
    expect(plan.updates).toEqual([{ id: "l1", set: { location: "Room 2" } }]);
  });

  it("treats blank and missing rooms as the same", () => {
    const plan = planClassScheduleChange({
      before: { ...MONDAY_4PM, location: null },
      after: { ...MONDAY_4PM, location: "  Room 4 " },
      lessons: [{ ...MONDAYS[0], location: "" }],
      now: NOW,
    });
    expect(plan.updates).toEqual([{ id: "l1", set: { location: "Room 4" } }]);
  });
});

describe("slotChangeSummary", () => {
  it("reports what a family needs to know", () => {
    expect(
      slotChangeSummary(MONDAY_4PM, { ...MONDAY_4PM, weekday: 2, location: "Room 2" }),
    ).toEqual({ when: true, room: true, tutor: false });
  });

  it("ignores time formatting and blank rooms", () => {
    expect(
      slotChangeSummary(
        { ...MONDAY_4PM, location: null },
        { ...MONDAY_4PM, startTime: "16:00", endTime: "17:00", location: " " },
      ),
    ).toEqual({ when: false, room: false, tutor: false });
  });
});

describe("classChangeTitle", () => {
  it("names what changed", () => {
    expect(classChangeTitle({ when: true, room: false, tutor: false })).toBe("Class time changed");
    expect(classChangeTitle({ when: true, room: true, tutor: false })).toBe("Class time and room changed");
    expect(classChangeTitle({ when: true, room: true, tutor: true })).toBe(
      "Class time, room and tutor changed",
    );
    expect(classChangeTitle({ when: false, room: false, tutor: false })).toBe("Class updated");
  });
});

describe("weeklySlotLabel", () => {
  it("spells out the day and time", () => {
    expect(weeklySlotLabel(MONDAY_4PM)).toBe("Monday · 4:00 – 5:00 pm");
  });

  it("says when there is no weekly time", () => {
    expect(weeklySlotLabel({ ...MONDAY_4PM, isRecurring: false })).toBe("No weekly time");
  });
});

describe("classMoveSentence", () => {
  const room = { when: false, room: true, tutor: false };
  it("matches the handoff's example", () => {
    expect(
      classMoveSentence("Year 9 Maths", { ...MONDAY_4PM, location: "Room 3" }, room, "2026-10-22"),
    ).toBe("Year 9 Maths moves to Room 3 from Thu 22 Oct.");
  });

  it("names the new day and time, and the room when both change", () => {
    const after = { ...MONDAY_4PM, weekday: 4, location: "Room 3" };
    expect(
      classMoveSentence("Year 9 Maths", after, { when: true, room: false, tutor: false }, "2026-10-22"),
    ).toBe("Year 9 Maths moves to Thursday 4:00 – 5:00 pm from Thu 22 Oct.");
    expect(
      classMoveSentence("Year 9 Maths", after, { when: true, room: true, tutor: false }, "2026-10-22"),
    ).toBe("Year 9 Maths moves to Thursday 4:00 – 5:00 pm in Room 3 from Thu 22 Oct.");
  });

  it("says when the room is cleared or there is no later lesson", () => {
    expect(classMoveSentence("Year 9 Maths", { ...MONDAY_4PM, location: " " }, room, null)).toBe(
      "Year 9 Maths has no set room.",
    );
  });

  it("says when the class stops having a weekly time", () => {
    expect(
      classMoveSentence(
        "Year 9 Maths",
        { ...MONDAY_4PM, isRecurring: false },
        { when: true, room: false, tutor: false },
        null,
      ),
    ).toBe("Year 9 Maths no longer has a weekly time.");
  });
});

describe("slotClassName", () => {
  it("names a class by its day and half of the day", () => {
    expect(slotClassName(MONDAY_4PM)).toBe("Monday PM");
    expect(slotClassName({ ...MONDAY_4PM, weekday: 6, startTime: "10:00" })).toBe("Saturday AM");
  });

  it("follows the slot only for names in that pattern", () => {
    expect(slotClassName({ ...MONDAY_4PM, weekday: 4 }, "Monday PM")).toBe("Thursday PM");
    expect(slotClassName({ ...MONDAY_4PM, weekday: 4 }, "QA Recurring Class")).toBeNull();
  });

  it("keeps the subject in front, as real class names have it", () => {
    expect(
      slotClassName({ ...MONDAY_4PM, weekday: 3 }, "Year 9 Maths · Thursday PM"),
    ).toBe("Year 9 Maths · Wednesday PM");
  });

  it("has nothing to say without a weekly slot", () => {
    expect(slotClassName({ ...MONDAY_4PM, isRecurring: false })).toBeNull();
  });
});
