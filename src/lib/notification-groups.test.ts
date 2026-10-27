import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_GROUPS,
  notificationGroupFor,
  notificationSections,
  notificationWhen,
  type NotificationGroupKey,
  type NotificationWhen,
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

  it("routes admin payment reminders to the parent's action needed group", () => {
    expect(
      notificationGroupFor({
        title: "Payment reminder",
        href: "/parent/payments",
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

  it("keeps a withdrawn tutor leave request as an update, not an action", () => {
    expect(
      notificationGroupFor({
        title: "Tutor leave withdrawn",
        href: "/admin/reschedules?tab=leave",
      }),
    ).toBe("updates");
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

  it("files a homework mark under learning and a resubmission under action needed", () => {
    expect(notificationGroupFor({ title: "Homework marked", href: "/student/homework/hw-1" })).toBe("learning");
    expect(
      notificationGroupFor({ title: "Resubmission requested", href: "/parent/homework/hw-1?child=stu-1" }),
    ).toBe("action");
  });

  it("routes tutor-facing to-dos to action needed", () => {
    for (const title of [
      "Announcement changes required",
      "Tutor announcement approval required",
      "Your class needs cover again",
      "Weekly hours due today",
      "Check your hours before Sunday",
      "Review your corrected hourly rate",
    ]) {
      expect(notificationGroupFor({ title, href: "/tutor" })).toBe("action");
    }
  });

  it("routes admin check-in follow-ups to action needed", () => {
    for (const title of [
      "Tutor check-in not approved",
      "Tutor check-in still not approved",
      "Tutor reported incorrect hours",
    ]) {
      expect(
        notificationGroupFor({ title, href: "/admin/tutor-checkins?week=2026-10-19" }),
      ).toBe("action");
    }
  });

  it("keeps an approved tutor announcement in announcements", () => {
    expect(
      notificationGroupFor({
        title: "Announcement approved",
        href: "/tutor/classes/class-1/announcements",
      }),
    ).toBe("announcements");
  });

  it("classifies titles that embed user text by their fixed prefix", () => {
    // A thread or announcement title can contain any keyword; it must not
    // move the notification into another group.
    expect(
      notificationGroupFor({
        title: 'New reply on "Can I request an announcement extension?"',
        href: "/student/discussions/admin/thread-1",
      }),
    ).toBe("learning");
    expect(
      notificationGroupFor({
        title: "New announcement: Changes requested for the overdue booklet",
        href: "/tutor",
      }),
    ).toBe("announcements");
    expect(
      notificationGroupFor({
        title: "Urgent announcement: Centre closed today",
        href: "/admin/announcements",
      }),
    ).toBe("announcements");
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
    expect(
      notificationGroupFor({ title: "Make-up booking undone", href: null }),
    ).toBe("updates");
  });

  it("treats an admin's class changes as schedule updates for every role", () => {
    const cases = [
      { title: "Class time changed", href: "/tutor/classes/c1" },
      { title: "Class room changed", href: "/student/timetable" },
      { title: "Class time, room and tutor changed", href: "/parent/classes/c1?child=s1" },
      { title: "Class tutor changed", href: "/student/timetable" },
      { title: "Class reassigned", href: "/tutor/timetable" },
      { title: "Class removed", href: "/parent" },
      { title: "New class assigned", href: "/tutor/classes/c1" },
    ];
    for (const c of cases) expect(notificationGroupFor(c)).toBe("updates");
  });

  it("asks admin to act on a trial's last day and tells the tutor once the student has left", () => {
    expect(
      notificationGroupFor({ title: "Free trial ends today", href: "/admin/users/s1" }),
    ).toBe("action");
    expect(
      notificationGroupFor({ title: "Free trial ended", href: "/tutor/classes/c1/students" }),
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

describe("notificationWhen", () => {
  // Wed 14 Oct 2026, 3 pm in Melbourne (AEDT, UTC+11).
  const now = new Date("2026-10-14T04:00:00.000Z");

  it("is today for anything since Melbourne midnight", () => {
    // 12:30 am Wed in Melbourne is still Tuesday in UTC.
    expect(notificationWhen(new Date("2026-10-13T13:30:00.000Z"), now)).toBe("today");
  });
  it("is this week from Monday onwards", () => {
    expect(notificationWhen(new Date("2026-10-13T01:00:00.000Z"), now)).toBe("week");
    // Mon 12 Oct, 12:30 am Melbourne.
    expect(notificationWhen(new Date("2026-10-11T13:30:00.000Z"), now)).toBe("week");
  });
  it("is earlier before Monday", () => {
    // Sun 11 Oct, 11 pm Melbourne.
    expect(notificationWhen(new Date("2026-10-11T12:00:00.000Z"), now)).toBe("earlier");
  });
  it("on a Monday, only today is this week", () => {
    const monday = new Date("2026-10-12T04:00:00.000Z");
    expect(notificationWhen(new Date("2026-10-11T04:00:00.000Z"), monday)).toBe("earlier");
  });
});

describe("notificationSections", () => {
  const row = (id: string, group: NotificationGroupKey, when: NotificationWhen = "today") => ({
    id,
    group,
    when,
  });

  it("orders every kind by date: Today, This week, Earlier", () => {
    // Newest-first input, as the inbox query returns it.
    const sections = notificationSections([
      row("u1", "updates", "today"),
      row("x2", "action", "today"),
      row("a1", "announcements", "week"),
      row("m1", "messages", "week"),
      row("x1", "action", "earlier"),
      row("l1", "learning", "earlier"),
    ]);
    expect(sections.map((s) => [s.key, s.label, s.items.map((i) => i.id)])).toEqual([
      ["today", "Today", ["u1", "x2"]],
      ["week", "This week", ["a1", "m1"]],
      ["earlier", "Earlier", ["x1", "l1"]],
    ]);
  });

  it("does not lift messages or action items above newer rows", () => {
    const sections = notificationSections([
      row("u1", "updates", "today"),
      row("m1", "messages", "earlier"),
    ]);
    expect(sections.map((s) => s.items.map((i) => i.id))).toEqual([["u1"], ["m1"]]);
  });

  it("drops empty sections and returns none for an empty inbox", () => {
    expect(notificationSections([row("x", "action", "week")]).map((s) => s.key)).toEqual(["week"]);
    expect(notificationSections([])).toEqual([]);
  });
});
