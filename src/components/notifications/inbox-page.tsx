import { announcementIdFromDedupeKey } from "@/lib/announcement-rules";
import { inboxStamp } from "@/lib/format";
import { notificationGroupFor, notificationWhen } from "@/lib/notification-groups";
import { getNotifications } from "@/lib/notifications";
import {
  NotificationsInboxView,
  type InboxItem,
} from "@/components/notifications/inbox-view";

/** Matches getUrgentUnreadCount's `URGENT:%` (case-insensitive) in lib/notifications. */
const URGENT_PREFIX = /^urgent:\s*/i;

export async function NotificationsInbox({ userId }: { userId: string }) {
  const rows = await getNotifications(userId, 100);
  const now = new Date();

  const items: InboxItem[] = rows.map((row) => {
    const createdAt = new Date(row.createdAt);
    const announcementId = announcementIdFromDedupeKey(row.dedupeKey);
    const isUrgent = URGENT_PREFIX.test(row.title);
    return {
      id: row.id,
      // The Urgent pill says it; the title does not repeat "URGENT:".
      title: isUrgent ? row.title.replace(URGENT_PREFIX, "") : row.title,
      body: row.body,
      // An announcement is read here in full, so its row opens in place
      // rather than following the link it was sent with.
      href: announcementId ? null : row.href,
      announcementId,
      isUnread: !row.readAt,
      isUrgent,
      group: notificationGroupFor(row),
      when: notificationWhen(createdAt, now),
      createdAtIso: createdAt.toISOString(),
      timeLabel: inboxStamp(createdAt, now),
    };
  });

  return <NotificationsInboxView items={items} />;
}
