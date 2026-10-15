export type NotificationGroupKey =
  | "messages"
  | "action"
  | "learning"
  | "announcements"
  | "updates";

export type NotificationLike = {
  title: string;
  href: string | null;
  readAt: Date | null;
};

/**
 * `label` names the filter pill and the section divider; `itemLabel` is the
 * kind shown on a single row ("Message", "Announcement").
 */
export const NOTIFICATION_GROUPS: Array<{
  key: NotificationGroupKey;
  label: string;
  itemLabel: string;
}> = [
  { key: "messages", label: "Messages", itemLabel: "Message" },
  { key: "action", label: "Action needed", itemLabel: "Action needed" },
  { key: "learning", label: "Learning", itemLabel: "Learning" },
  { key: "announcements", label: "Announcements", itemLabel: "Announcement" },
  { key: "updates", label: "Updates", itemLabel: "Update" },
];

export function notificationGroupFor(
  notification: Pick<NotificationLike, "title" | "href">,
): NotificationGroupKey {
  const title = notification.title.toLowerCase();
  const href = notification.href?.toLowerCase() ?? "";

  if (href.includes("/messages") || title.startsWith("new message")) {
    return "messages";
  }
  // These titles embed user-written text (a thread or announcement title), so
  // they are matched on their fixed prefix before any keyword below can be
  // triggered by whatever the author happened to type.
  if (title.startsWith("new reply on")) return "learning";
  if (
    title.startsWith("new announcement") ||
    title.startsWith("urgent announcement")
  ) {
    return "announcements";
  }
  if (
    title.startsWith("urgent:") ||
    title.startsWith("review ") ||
    title.includes("approval required") ||
    title.includes("needs cover") ||
    title.includes("hours due") ||
    title.startsWith("check your hours") ||
    title.includes("cover needed") ||
    title.includes("cover request") ||
    title.includes("relocate class time") ||
    title.includes("requested") ||
    title.includes("request") ||
    title.includes("ready for review") ||
    title.includes("changes required") ||
    title.includes("changes requested") ||
    title.includes("overdue") ||
    title.startsWith("payment reminder") ||
    title.includes("declined") ||
    title.includes("cancelled") ||
    title.includes("canceled")
  ) {
    return "action";
  }
  if (href.includes("/announcements") || title.includes("announcement")) {
    return "announcements";
  }
  if (
    href.includes("/quizzes") ||
    href.includes("/homework") ||
    href.includes("/discussions") ||
    href.includes("/resources") ||
    href.includes("/progress") ||
    href.includes("/reports") ||
    title.includes("quiz") ||
    title.includes("homework") ||
    title.includes("feedback") ||
    title.includes("report")
  ) {
    return "learning";
  }
  return "updates";
}

export type NotificationWhen = "today" | "week" | "earlier";

const melbourneDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Melbourne",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function dayNumber(d: Date): number {
  const [y, m, day] = melbourneDay.format(d).split("-").map(Number);
  return Date.UTC(y, m - 1, day) / 86_400_000;
}

/**
 * When a notification arrived, by the Melbourne calendar: today, earlier in
 * this week (Monday onwards), or before that.
 */
export function notificationWhen(createdAt: Date, now: Date = new Date()): NotificationWhen {
  const today = dayNumber(now);
  const day = dayNumber(createdAt);
  if (day >= today) return "today";
  // 1970-01-01 was a Thursday, so (n + 3) % 7 counts days since Monday.
  const monday = today - ((today + 3) % 7);
  return day >= monday ? "week" : "earlier";
}

export type NotificationSectionKey = "messages" | "action" | NotificationWhen;

const WHEN_LABEL: Record<NotificationWhen, string> = {
  today: "Today",
  week: "This week",
  earlier: "Earlier",
};

/**
 * The inbox's sections: direct messages, then action items, each under its
 * own divider, so they always sit above announcements and general updates;
 * everything else follows under Today, This week and Earlier. Each section
 * keeps the incoming (newest-first) order; empty sections are dropped.
 */
export function notificationSections<
  T extends { group: NotificationGroupKey; when: NotificationWhen },
>(items: T[]): Array<{ key: NotificationSectionKey; label: string; items: T[] }> {
  const sections: Array<{ key: NotificationSectionKey; label: string; items: T[] }> = [
    { key: "messages", label: "Messages", items: items.filter((i) => i.group === "messages") },
    { key: "action", label: "Action needed", items: items.filter((i) => i.group === "action") },
  ];
  const rest = items.filter((i) => i.group !== "messages" && i.group !== "action");
  for (const when of ["today", "week", "earlier"] as const) {
    sections.push({ key: when, label: WHEN_LABEL[when], items: rest.filter((i) => i.when === when) });
  }
  return sections.filter((section) => section.items.length > 0);
}
