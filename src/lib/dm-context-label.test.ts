import { describe, expect, it } from "vitest";
import { conversationContextLabel } from "./dm-context-label";

const sarah = {
  id: "s1",
  firstName: "Sarah",
  lastName: "Student",
  classNames: ["Year 9 Maths", "Year 9 Maths"],
};
const tom = {
  id: "s2",
  firstName: "Tom",
  lastName: "Student",
  classNames: ["Year 7 Maths"],
};

describe("conversationContextLabel", () => {
  it("names a student's classes", () => {
    expect(
      conversationContextLabel({ viewer: "tutor", other: "student", students: [sarah] }),
    ).toBe("Student · Year 9 Maths");
    expect(
      conversationContextLabel({ viewer: "admin", other: "student", students: [] }),
    ).toBe("Student");
  });

  it("names a parent's children and their classes", () => {
    expect(
      conversationContextLabel({ viewer: "tutor", other: "parent", students: [sarah] }),
    ).toBe("Parent of Sarah Student · Year 9 Maths");
    expect(
      conversationContextLabel({ viewer: "admin", other: "parent", students: [sarah, tom] }),
    ).toBe("Parent of Sarah Student and Tom Student · Year 9 Maths, Year 7 Maths");
    expect(
      conversationContextLabel({ viewer: "admin", other: "parent", students: [] }),
    ).toBe("Parent");
  });

  it("names the classes a tutor teaches the viewer or their children", () => {
    expect(
      conversationContextLabel({ viewer: "student", other: "tutor", students: [sarah] }),
    ).toBe("Tutor · Year 9 Maths");
    expect(
      conversationContextLabel({ viewer: "parent", other: "tutor", students: [sarah, tom] }),
    ).toBe("Sarah and Tom's tutor · Year 9 Maths, Year 7 Maths");
    expect(
      conversationContextLabel({ viewer: "parent", other: "tutor", students: [] }),
    ).toBe("Tutor");
  });

  it("lists every class for an admin viewing a tutor", () => {
    expect(
      conversationContextLabel({
        viewer: "admin",
        other: "tutor",
        students: [],
        tutorClassNames: ["Year 9 Maths", "Year 11 Chemistry"],
      }),
    ).toBe("Tutor · Year 9 Maths, Year 11 Chemistry");
  });

  it("shows the office as Admin, keeping the tier for other admins", () => {
    expect(
      conversationContextLabel({ viewer: "parent", other: "admin", students: [] }),
    ).toBe("Admin");
    expect(
      conversationContextLabel({ viewer: "admin", other: "admin", students: [] }),
    ).toBeNull();
  });
});
