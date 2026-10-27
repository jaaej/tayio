import { describe, expect, it } from "vitest";
import { notificationGroupFor } from "./notification-groups";
import { homeworkResultNotifications } from "./homework-result-notifications";

const base = {
  homeworkId: "hw-1",
  homeworkTitle: "Request letter",
  studentId: "stu-1",
  studentFirstName: "Sarah",
  parentIds: ["par-1", "par-2"],
  score: "70.00",
  hasFeedback: true,
  markedAt: new Date("2026-10-26T01:00:00Z"),
};

describe("homeworkResultNotifications", () => {
  it("tells the student and every linked parent a mark, with the score", () => {
    const rows = homeworkResultNotifications({ ...base, result: "marked" });
    expect(rows.map((r) => r.userId)).toEqual(["stu-1", "par-1", "par-2"]);
    expect(rows[0]).toMatchObject({
      title: "Homework marked",
      body: "Request letter · 70%",
      href: "/student/homework/hw-1",
    });
    expect(rows[1]).toMatchObject({
      body: "Sarah · Request letter · 70%",
      href: "/parent/homework/hw-1?child=stu-1",
    });
  });

  it("leaves the score out when there is none", () => {
    const [row] = homeworkResultNotifications({ ...base, score: null, result: "marked" });
    expect(row.body).toBe("Request letter");
  });

  it("asks for a resubmission in words for each reader", () => {
    const rows = homeworkResultNotifications({ ...base, result: "resubmission_requested" });
    expect(rows[0].title).toBe("Resubmission requested");
    expect(rows[0].body).toBe("Request letter needs to be done again. See your tutor's feedback.");
    expect(rows[1].body).toBe("Sarah · Request letter needs to be done again. See the tutor's feedback.");
  });

  it("points to feedback only when there is some", () => {
    const [row] = homeworkResultNotifications({ ...base, hasFeedback: false, result: "resubmission_requested" });
    expect(row.body).toBe("Request letter needs to be done again.");
  });

  it("files a mark under Learning and a resubmission under Action needed, whatever the title", () => {
    const [marked] = homeworkResultNotifications({ ...base, result: "marked" });
    const [again] = homeworkResultNotifications({ ...base, result: "resubmission_requested" });
    expect(notificationGroupFor(marked)).toBe("learning");
    expect(notificationGroupFor(again)).toBe("action");
  });

  it("gives each marking its own dedupe key", () => {
    const [a] = homeworkResultNotifications({ ...base, result: "marked" });
    const [b] = homeworkResultNotifications({ ...base, result: "marked", markedAt: new Date("2026-10-27T01:00:00Z") });
    expect(a.dedupeKey).not.toBe(b.dedupeKey);
  });
});
