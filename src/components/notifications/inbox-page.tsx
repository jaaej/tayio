import { inboxStamp } from "@/lib/format";
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
  // One clock for the whole render so neighbouring rows never straddle a
  // day boundary that rolled over mid-loop.
  const now = new Date();

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
      timeLabel: inboxStamp(createdAt, now),
    };
  });

  return (
    <NotificationsInboxView
      items={items}
      showUnreadCallout={showUnreadCallout}
    />
  );
}
