import { announcementIdFromDedupeKey } from "@/lib/announcement-rules";
import { inboxStamp } from "@/lib/format";
import { notificationGroupFor, notificationWhen } from "@/lib/notification-groups";
import { getNotifications } from "@/lib/notifications";
import {
  NotificationsInboxView,
  type InboxItem,
} from "@/components/notifications/inbox-view";

export async function NotificationsInbox({ userId }: { userId: string }) {
  const rows = await getNotifications(userId, 100);
  const now = new Date();

  const items: InboxItem[] = rows.map((row) => {
    const createdAt = new Date(row.createdAt);
    const announcementId = announcementIdFromDedupeKey(row.dedupeKey);
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      // An announcement is read here in full, so its row opens in place
      // rather than following the link it was sent with.
      href: announcementId ? null : row.href,
      announcementId,
      isUnread: !row.readAt,
      isUrgent: row.title.toUpperCase().startsWith("URGENT:"),
      group: notificationGroupFor(row),
      when: notificationWhen(createdAt, now),
      createdAtIso: createdAt.toISOString(),
      timeLabel: inboxStamp(createdAt, now),
    };
  });

  return <NotificationsInboxView items={items} />;
}
