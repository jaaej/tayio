import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_GROUPS,
  notificationGroupFor,
  notificationSections,
  type NotificationGroupKey,
} from "./notification-groups";

describe("notificationGroupFor", () => {
  it("keeps direct messages separate from other activity", () => {
    expect(
      notificationGroupFor({
        title: "New message from Alex",
        href: "/student/messages/thread-1",
      }),
    ).toBe("messages");
  });

  it("keeps announcements in their own group", () => {
    expect(
      notificationGroupFor({
        title: "New announcement",
        href: "/student/announcements",
      }),
    ).toBe("announcements");
  });

  it("routes a tutor class announcement by title even when the href is the dashboard", () => {
    // Tutor class announcements notify students with an href to /student
    // (where the announcement surfaces), so the "announcement" title keyword -
    // not the href - must land it in the Announcements group.
    expect(
      notificationGroupFor({
        title: "New announcement in Year 9 Maths",
        href: "/student",
      }),
    ).toBe("announcements");
  });

  it("prioritises requests as action items", () => {
    expect(
      notificationGroupFor({
        title: "Quiz requested",
        href: "/tutor/quizzes/quiz-1",
      }),
    ).toBe("action");
  });

  it("routes urgent tutor cover alerts to action needed", () => {
    expect(
      notificationGroupFor({
        title: "URGENT: Cover still needed within 24h",
        href: "/admin/reschedules#tutor-cover",
      }),
    ).toBe("action");
  });

  it("routes permanent class relocation requests to action needed", () => {
    expect(
      notificationGroupFor({
        title: "Relocate class time for Sarah Student",
        href: "/admin/users/student-id?tab=lessons#class-moves",
      }),
    ).toBe("action");
  });

  it("keeps a submitted quiz in the admin action section", () => {
    expect(
      notificationGroupFor({
        title: "Quiz ready for review",
        href: "/admin/quizzes/quiz-1",
      }),
    ).toBe("action");
  });

  it("groups a student term report as a learning update", () => {
    expect(
      notificationGroupFor({
        title: "Term report ready",
        href: "/reports/student-1/term-1",
      }),
    ).toBe("learning");
  });

  it("groups routine quiz activity as learning updates", () => {
    expect(
      notificationGroupFor({
        title: "Quiz approved",
        href: "/tutor/quizzes/quiz-1",
      }),
    ).toBe("learning");
  });

  it("treats admin credit/allowance actions as account updates", () => {
    // Admin-side credit grants, allowance top-ups, and reversal confirmations
    // are informational (schedule/account activity), not action items.
    expect(
      notificationGroupFor({ title: "Class credit added", href: null }),
    ).toBe("updates");
    expect(
      notificationGroupFor({ title: "Extra allowance granted", href: null }),
    ).toBe("updates");
    expect(
      notificationGroupFor({ title: "Reschedule undone", href: null }),
    ).toBe("updates");
    expect(
      notificationGroupFor({ title: "Cancellation undone", href: null }),
    ).toBe("updates");
  });
});

describe("NOTIFICATION_GROUPS", () => {
  it("offers messages and action items ahead of announcements and updates", () => {
    // The inbox renders one filter pill per group in this order, so messages
    // and action items must stay in front of the passive categories.
    expect(NOTIFICATION_GROUPS.map((group) => group.key)).toEqual([
      "messages",
      "action",
      "learning",
      "announcements",
      "updates",
    ]);
  });
});

describe("notificationSections", () => {
  const row = (id: string, group: NotificationGroupKey) => ({ id, group });

  it("puts messages and action items above announcements and updates", () => {
    // Newest-first input where the passive rows happen to be the newest.
    const sections = notificationSections([
      row("u1", "updates"),
      row("a1", "announcements"),
      row("x1", "action"),
      row("l1", "learning"),
      row("m1", "messages"),
      row("x2", "action"),
    ]);
    expect(sections.map((s) => s.key)).toEqual([
      "messages",
      "action",
      "learning",
      "announcements",
      "updates",
    ]);
    expect(sections.map((s) => s.label)).toEqual([
      "Messages",
      "Action needed",
      "Learning updates",
      "Announcements",
      "Other updates",
    ]);
  });

  it("keeps the incoming order inside a section and drops empty sections", () => {
    const sections = notificationSections([
      row("x2", "action"),
      row("u1", "updates"),
      row("x1", "action"),
    ]);
    expect(sections.map((s) => s.key)).toEqual(["action", "updates"]);
    expect(sections[0].items.map((i) => i.id)).toEqual(["x2", "x1"]);
  });

  it("returns no sections for an empty inbox", () => {
    expect(notificationSections([])).toEqual([]);
  });
});
