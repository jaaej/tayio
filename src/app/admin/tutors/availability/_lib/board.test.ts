import { describe, expect, it } from "vitest";
import { boardSubjects, freeTutorCount, slotsForSubject } from "./board";

const any = { weekday: 1, subjectId: null, subjectName: null };
const maths = { weekday: 2, subjectId: "m", subjectName: "Maths" };
const english = { weekday: 2, subjectId: "e", subjectName: "English" };

describe("slotsForSubject", () => {
  it("keeps every slot without a subject filter", () => {
    expect(slotsForSubject([any, maths, english], "")).toEqual([any, maths, english]);
  });

  it("keeps the subject's slots and any-subject slots", () => {
    expect(slotsForSubject([any, maths, english], "m")).toEqual([any, maths]);
  });
});

describe("boardSubjects", () => {
  it("merges taught subjects with subjects that only have slots", () => {
    expect(
      boardSubjects([
        { subjects: [{ id: "m", name: "Maths" }], slots: [any, maths] },
        { subjects: [{ id: "m", name: "Maths" }], slots: [english] },
        { subjects: [], slots: [{ weekday: 3, subjectId: "x", subjectName: null }] },
      ]),
    ).toEqual([
      { id: "e", name: "English" },
      { id: "m", name: "Maths" },
      { id: "x", name: "Other subject" },
    ]);
  });
});

describe("freeTutorCount", () => {
  it("counts tutors with a slot on the weekday", () => {
    const tutors = [{ slots: [any, maths] }, { slots: [english] }, { slots: [] }];
    expect(freeTutorCount(tutors, 2)).toBe(2);
    expect(freeTutorCount(tutors, 1)).toBe(1);
    expect(freeTutorCount(tutors, 0)).toBe(0);
  });
});
