import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_GROUPS,
  notificationGroupFor,
  notificationTimeBucket,
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

describe("notificationTimeBucket", () => {
  // Wednesday 13 Aug 2026, 9am local.
  const now = new Date(2026, 7, 13, 9, 0, 0);

  it("puts anything from the current calendar day in today", () => {
    expect(notificationTimeBucket(new Date(2026, 7, 13, 0, 5), now)).toBe(
      "today",
    );
    expect(notificationTimeBucket(new Date(2026, 7, 13, 8, 59), now)).toBe(
      "today",
    );
  });

  it("puts the previous six days in this week", () => {
    expect(notificationTimeBucket(new Date(2026, 7, 12, 23, 59), now)).toBe(
      "week",
    );
    expect(notificationTimeBucket(new Date(2026, 7, 7, 0, 0), now)).toBe("week");
  });

  it("rolls the window rather than resetting it on Monday", () => {
    // Monday 17 Aug: yesterday (Sunday) belongs to the previous calendar week
    // but must still read as "This week", not "Earlier".
    const monday = new Date(2026, 7, 17, 9, 0, 0);
    expect(notificationTimeBucket(new Date(2026, 7, 16, 20, 0), monday)).toBe(
      "week",
    );
  });

  it("puts anything older than the window in earlier", () => {
    expect(notificationTimeBucket(new Date(2026, 7, 6, 23, 59), now)).toBe(
      "earlier",
    );
    expect(notificationTimeBucket(new Date(2026, 6, 1), now)).toBe("earlier");
  });
});
