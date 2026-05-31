import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getNotifications } from "@/lib/notifications";
import { relativeTime } from "@/lib/format";
import { markAllNotificationsRead } from "@/app/_actions/notifications";

export async function NotificationsInbox({
  userId,
}: {
  userId: string;
}) {
  const items = await getNotifications(userId, 100);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div className="space-y-6">
      <header className="rise flex items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
            Notifications
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {unread > 0
              ? `${unread} unread`
              : "All caught up."}
          </p>
        </div>
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50 hover:border-brand-300 transition-colors"
            >
              Mark all read
            </button>
          </form>
        )}
      </header>

      <Card className="p-0 overflow-hidden">
        {items.length === 0 ? (
          <div className="px-6 py-8 text-sm text-ink-soft">
            No notifications yet.
          </div>
        ) : (
          <ul className="divide-y divide-hairline/60">
            {items.map((n) => {
              const isUnread = !n.readAt;
              const body = (
                <div className="flex items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      {isUnread && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600 shrink-0" />
                      )}
                      <div
                        className={
                          "text-base truncate " +
                          (isUnread ? "text-ink font-medium" : "text-ink-soft")
                        }
                      >
                        {n.title}
                      </div>
                    </div>
                    {n.body && (
                      <p className="mt-1 text-sm text-ink-soft line-clamp-2 leading-relaxed">
                        {n.body}
                      </p>
                    )}
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-muted shrink-0 tabular-nums">
                    {relativeTime(new Date(n.createdAt))}
                  </div>
                </div>
              );
              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link
                      href={n.href}
                      className="block hover:bg-brand-50 transition-colors"
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
