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
  description: string;
}> = [
  {
    key: "messages",
    label: "Messages",
    description: "Direct messages from tutors, admins, students, and families",
  },
  {
    key: "action",
    label: "Action needed",
    description: "Requests, changes, deadlines, and decisions",
  },
  {
    key: "learning",
    label: "Learning updates",
    description: "Quizzes, homework, feedback, and discussions",
  },
  {
    key: "announcements",
    label: "Announcements",
    description: "General news and notices",
  },
  {
    key: "updates",
    label: "Other updates",
    description: "Schedule and account activity",
  },
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
    title.includes("quiz") ||
    title.includes("homework") ||
    title.includes("feedback")
  ) {
    return "learning";
  }
  return "updates";
}

export function groupNotifications<T extends NotificationLike>(
  notifications: T[],
): Array<{
  key: NotificationGroupKey;
  label: string;
  description: string;
  unread: number;
  items: T[];
}> {
  return NOTIFICATION_GROUPS.map((group) => {
    const items = notifications.filter(
      (notification) => notificationGroupFor(notification) === group.key,
    );
    return {
      ...group,
      unread: items.filter((item) => !item.readAt).length,
      items,
    };
  }).filter((group) => group.items.length > 0);
}
