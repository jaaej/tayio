import { describe, expect, it } from "vitest";
import {
  groupNotifications,
  notificationGroupFor,
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

  it("keeps a submitted quiz in the admin action section", () => {
    expect(
      notificationGroupFor({
        title: "Quiz ready for review",
        href: "/admin/quizzes/quiz-1",
      }),
    ).toBe("action");
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

describe("groupNotifications", () => {
  it("orders important messages before announcements regardless of time order", () => {
    const groups = groupNotifications([
      {
        title: "New announcement",
        href: "/student/announcements",
        readAt: null,
      },
      {
        title: "New message from Tutor",
        href: "/student/messages/thread-1",
        readAt: null,
      },
    ]);

    expect(groups.map((group) => group.key)).toEqual([
      "messages",
      "announcements",
    ]);
    expect(groups[0].unread).toBe(1);
  });
});
