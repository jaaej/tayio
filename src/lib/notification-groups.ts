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
    title.includes("requested") ||
    title.includes("request") ||
    title.includes("ready for review") ||
    title.includes("changes required") ||
    title.includes("changes requested") ||
    title.includes("overdue") ||
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

export type NotificationTimeBucket = "today" | "week" | "earlier";

export const NOTIFICATION_TIME_BUCKETS: Array<{
  key: NotificationTimeBucket;
  label: string;
}> = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "earlier", label: "Earlier" },
];

/**
 * "This week" is a rolling six days behind today, not the calendar week: on a
 * Monday morning a calendar week would push yesterday's notifications into
 * "Earlier", which reads as wrong to anyone who just saw them arrive.
 */
export function notificationTimeBucket(
  createdAt: Date,
  now: Date,
): NotificationTimeBucket {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  if (createdAt.getTime() >= startOfToday.getTime()) return "today";

  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 6);
  if (createdAt.getTime() >= startOfWeek.getTime()) return "week";

  return "earlier";
}
