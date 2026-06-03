import Link from "next/link";
import { Card } from "./card";
import { Button } from "./button";
import { PageHead } from "./page-head";
import { getNotifications } from "@/lib/notifications";
import { relativeTime } from "@/lib/format";
import { markAllNotificationsRead } from "@/app/_actions/notifications";

/**
 * Student-portal NotificationsInbox (v2 design). Kept separate from the
 * shared @/components/notifications/inbox-page so parent/tutor/admin keep
 * their existing inbox styling.
 */
export async function NotificationsInbox({
  userId,
}: {
  userId: string;
}) {
  const items = await getNotifications(userId, 100);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Notifications"
        title="Inbox"
        sub={unread > 0 ? `${unread} unread` : "All caught up."}
        actions={
          unread > 0 ? (
            <form action={markAllNotificationsRead}>
              <Button type="submit" variant="default" size="sm">
                Mark all read
              </Button>
            </form>
          ) : null
        }
      />

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted">
            No notifications yet.
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => {
              const isUnread = !n.readAt;
              const body = (
                <div className="flex items-start justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      {isUnread && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
                      )}
                      <div
                        className={
                          "text-[14px] truncate " +
                          (isUnread
                            ? "text-ink font-bold"
                            : "text-ink-soft font-semibold")
                        }
                      >
                        {n.title}
                      </div>
                    </div>
                    {n.body && (
                      <p className="mt-1 text-[12px] text-muted line-clamp-2 leading-relaxed">
                        {n.body}
                      </p>
                    )}
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-muted shrink-0 tabular-nums font-bold">
                    {relativeTime(new Date(n.createdAt))}
                  </div>
                </div>
              );
              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link
                      href={n.href}
                      className="block hover:bg-surface-2 transition-colors"
                    >
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
