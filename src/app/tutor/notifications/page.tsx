import Link from "next/link";
import { Card, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { requireRole } from "@/lib/auth";
import { getNotifications } from "@/lib/notifications";
import { relativeTime } from "@/lib/format";
import { markAllNotificationsRead } from "@/app/_actions/notifications";

export default async function TutorNotificationsPage() {
  const user = await requireRole("tutor");
  const items = await getNotifications(user.id, 100);
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
              <button
                type="submit"
                className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[12px] font-bold text-ink hover:bg-brand-50 hover:border-brand-300 transition-colors"
              >
                Mark all read
              </button>
            </form>
          ) : undefined
        }
      />

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <CardBody>
            <div className="py-4 text-sm text-muted text-center">
              No notifications yet.
            </div>
          </CardBody>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => {
              const isUnread = !n.readAt;
              const body = (
                <div className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      {isUnread && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
                      )}
                      <div
                        className={
                          "text-[13px] truncate " +
                          (isUnread ? "text-ink font-bold" : "text-ink-soft")
                        }
                      >
                        {n.title}
                      </div>
                    </div>
                    {n.body && (
                      <p className="mt-1 text-[12px] text-muted line-clamp-2 leading-snug">
                        {n.body}
                      </p>
                    )}
                  </div>
                  <div className="text-[11px] text-muted shrink-0 tabular-nums">
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
