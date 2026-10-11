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

export const NOTIFICATION_GROUPS: Array<{
  key: NotificationGroupKey;
  label: string;
}> = [
  { key: "messages", label: "Messages" },
  { key: "action", label: "Action needed" },
  { key: "learning", label: "Learning updates" },
  { key: "announcements", label: "Announcements" },
  { key: "updates", label: "Other updates" },
];

export function notificationGroupFor(
  notification: Pick<NotificationLike, "title" | "href">,
): NotificationGroupKey {
  const title = notification.title.toLowerCase();
  const href = notification.href?.toLowerCase() ?? "";

  if (href.includes("/messages") || title.startsWith("new message")) {
    return "messages";
  }
  if (href.includes("/announcements") || title.includes("announcement")) {
    return "announcements";
  }
  if (
    title.startsWith("urgent:") ||
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

/**
 * Splits inbox rows into one labelled section per group, in
 * NOTIFICATION_GROUPS order, so direct messages and action items always sit
 * above announcements and general updates. Empty sections are dropped and
 * each section keeps the incoming (newest-first) order.
 */
export function notificationSections<T extends { group: NotificationGroupKey }>(
  items: T[],
): Array<{ key: NotificationGroupKey; label: string; items: T[] }> {
  return NOTIFICATION_GROUPS.map((group) => ({
    ...group,
    items: items.filter((item) => item.group === group.key),
  })).filter((section) => section.items.length > 0);
}

