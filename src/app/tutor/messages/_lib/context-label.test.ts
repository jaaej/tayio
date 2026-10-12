import { describe, expect, it } from "vitest";
import { tutorConversationContext } from "./context-label";

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

describe("tutorConversationContext", () => {
  it("names a student's classes and links to their profile", () => {
    expect(
      tutorConversationContext({ id: "s1", kind: "student" }, [sarah]),
    ).toEqual({
      context: "Student · Year 9 Maths",
      profileHref: "/tutor/students/s1",
      profileLabel: "View profile",
    });
  });

  it("names a parent's children and links to the first child", () => {
    expect(
      tutorConversationContext({ id: "p1", kind: "parent" }, [sarah]),
    ).toEqual({
      context: "Parent of Sarah Student · Year 9 Maths",
      profileHref: "/tutor/students/s1",
      profileLabel: "View Sarah",
    });
    expect(
      tutorConversationContext({ id: "p1", kind: "parent" }, [sarah, tom])
        ?.context,
    ).toBe("Parent of Sarah Student and Tom Student · Year 9 Maths · Year 7 Maths");
  });

  it("returns null when the tutor teaches nobody in the conversation", () => {
    expect(tutorConversationContext({ id: "s9", kind: "student" }, [sarah])).toBeNull();
    expect(tutorConversationContext({ id: "p1", kind: "parent" }, [])).toBeNull();
  });
});
