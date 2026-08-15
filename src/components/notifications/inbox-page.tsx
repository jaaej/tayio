import { relativeTime } from "@/lib/format";
import {
  notificationGroupFor,
  notificationTimeBucket,
} from "@/lib/notification-groups";
import { getNotifications } from "@/lib/notifications";
import {
  NotificationsInboxView,
  type InboxItem,
} from "@/components/notifications/inbox-view";

export async function NotificationsInbox({
  userId,
}: {
  userId: string;
}) {
  const rows = await getNotifications(userId, 100);
  // One clock for the whole render: bucketing every row against the same `now`
  // stops a row landing in "Today" and its neighbour in "This week" because the
  // day rolled over mid-loop.
  const now = new Date();

  const items: InboxItem[] = rows.map((row) => {
    const createdAt = new Date(row.createdAt);
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      href: row.href,
      isUnread: !row.readAt,
      group: notificationGroupFor(row),
      bucket: notificationTimeBucket(createdAt, now),
      createdAtIso: createdAt.toISOString(),
      timeLabel: relativeTime(createdAt),
    };
  });

  return <NotificationsInboxView items={items} />;
}
