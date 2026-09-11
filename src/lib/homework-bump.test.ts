import { describe, expect, it } from "vitest";
import { buildHomeworkBumpMessage } from "./homework-bump";

describe("buildHomeworkBumpMessage", () => {
  it("names one specific overdue task", () => {
    expect(
      buildHomeworkBumpMessage({
        studentFirstName: "Mia",
        homeworkTitles: ["Algebra worksheet"],
      }),
    ).toContain("task is: “Algebra worksheet”");
  });

  it("lists several tasks and safely caps a long message", () => {
    const message = buildHomeworkBumpMessage({
      studentFirstName: "Noah",
      homeworkTitles: ["One", "Two", "Three", "Four", "Five", "Six"],
    });
    expect(message).toContain("tasks are: “One”, “Two”, “Three”, “Four”, “Five”");
    expect(message).toContain("plus 1 more");
    expect(message).not.toContain("“Six”");
  });
});
