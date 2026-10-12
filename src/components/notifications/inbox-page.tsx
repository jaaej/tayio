import { relativeTime } from "@/lib/format";
import { notificationGroupFor } from "@/lib/notification-groups";
import { getNotifications } from "@/lib/notifications";
import {
  NotificationsInboxView,
  type InboxItem,
} from "@/components/notifications/inbox-view";

export async function NotificationsInbox({
  userId,
  showUnreadCallout = true,
}: {
  userId: string;
  showUnreadCallout?: boolean;
}) {
  const rows = await getNotifications(userId, 100);

  const items: InboxItem[] = rows.map((row) => {
    const createdAt = new Date(row.createdAt);
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      href: row.href,
      isUnread: !row.readAt,
      isUrgent: row.title.toUpperCase().startsWith("URGENT:"),
      group: notificationGroupFor(row),
      createdAtIso: createdAt.toISOString(),
      timeLabel: relativeTime(createdAt),
    };
  });

  return (
    <NotificationsInboxView
      items={items}
      showUnreadCallout={showUnreadCallout}
    />
  );
}
