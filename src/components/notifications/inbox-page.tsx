import Link from "next/link";
import {
  Bell,
  BellRing,
  CheckCheck,
  GraduationCap,
  Megaphone,
  MessageSquare,
} from "lucide-react";
import { markAllNotificationsRead } from "@/app/_actions/notifications";
import { relativeTime } from "@/lib/format";
import {
  groupNotifications,
  type NotificationGroupKey,
} from "@/lib/notification-groups";
import { getNotifications } from "@/lib/notifications";

export async function NotificationsInbox({
  userId,
}: {
  userId: string;
}) {
  const items = await getNotifications(userId, 100);
  const unread = items.filter((notification) => !notification.readAt).length;
  const groups = groupNotifications(items);

  return (
    <div className="w-full space-y-5">
      <header className="relative overflow-hidden rounded-[22px] border border-brand-200 bg-[linear-gradient(135deg,#F3F4FF_0%,#FFFFFF_52%,#EEF0FF_100%)] p-5 shadow-[0_16px_38px_-28px_rgba(31,40,90,0.42)] sm:p-6">
        <div
          aria-hidden
          className="absolute -right-14 -top-20 h-56 w-56 rounded-full border-[34px] border-brand-200/40"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-brand-600 text-white shadow-[0_12px_24px_-16px_rgba(79,91,213,0.9)]">
              <BellRing className="h-5 w-5" />
            </span>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand-700">
                Notifications
              </div>
              <h1 className="mt-0.5 text-[28px] font-extrabold tracking-[-0.025em] text-ink sm:text-[34px]">
                Inbox
              </h1>
              <p className="mt-1 text-[13px] font-semibold text-muted">
                {unread > 0
                  ? `${unread} unread across ${groups.length} ${groups.length === 1 ? "section" : "sections"}`
                  : "All caught up."}
              </p>
            </div>
          </div>

          {unread > 0 && (
            <form action={markAllNotificationsRead}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-200 bg-white px-4 text-[12px] font-bold text-brand-800 shadow-[0_8px_18px_-16px_rgba(31,40,90,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </button>
            </form>
          )}
        </div>
      </header>

      {items.length === 0 ? (
        <div className="grid min-h-56 place-items-center rounded-[20px] border-2 border-dashed border-line bg-surface/70 p-6 text-center">
          <div>
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-[14px] bg-surface-2 text-muted">
              <Bell className="h-5 w-5" />
            </span>
            <h2 className="mt-3 text-[16px] font-extrabold text-ink">
              Nothing here yet
            </h2>
            <p className="mt-1 text-[12px] font-semibold text-muted">
              New messages and updates will appear in their own sections.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`notifications-${group.key}`}>
              <div className="mb-2.5 flex items-center gap-3 px-1">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-brand-100 text-brand-700">
                  <GroupIcon group={group.key} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h2
                      id={`notifications-${group.key}`}
                      className="text-[16px] font-extrabold tracking-[-0.01em] text-ink"
                    >
                      {group.label}
                    </h2>
                    <span className="text-[11px] font-bold text-muted tabular-nums">
                      {group.items.length}
                    </span>
                    {group.unread > 0 && (
                      <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-white">
                        {group.unread} unread
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] font-semibold text-muted">
                    {group.description}
                  </p>
                </div>
                <div aria-hidden className="h-px min-w-8 flex-1 bg-line" />
              </div>

              <div className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-[0_12px_30px_-26px_rgba(31,40,90,0.34)]">
                <ul className="divide-y divide-line">
                  {group.items.map((notification) => {
                    const isUnread = !notification.readAt;
                    const body = (
                      <div className="flex min-h-[76px] items-start gap-3 px-4 py-3.5 sm:px-5">
                        <span
                          aria-hidden
                          className={
                            "mt-1.5 h-2 w-2 shrink-0 rounded-full " +
                            (isUnread ? "bg-brand-500" : "bg-line-strong")
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <div
                            className={
                              "text-[14px] leading-snug " +
                              (isUnread
                                ? "font-extrabold text-ink"
                                : "font-semibold text-ink-soft")
                            }
                          >
                            {notification.title}
                          </div>
                          {notification.body && (
                            <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-relaxed text-muted">
                              {notification.body}
                            </p>
                          )}
                        </div>
                        <time
                          dateTime={new Date(notification.createdAt).toISOString()}
                          className="shrink-0 pt-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted tabular-nums"
                        >
                          {relativeTime(new Date(notification.createdAt))}
                        </time>
                      </div>
                    );

                    return (
                      <li key={notification.id}>
                        {notification.href ? (
                          <Link
                            href={notification.href}
                            className="block transition-colors duration-200 hover:bg-brand-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 motion-reduce:transition-none"
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
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupIcon({ group }: { group: NotificationGroupKey }) {
  if (group === "messages") return <MessageSquare className="h-4 w-4" />;
  if (group === "action") return <BellRing className="h-4 w-4" />;
  if (group === "learning") return <GraduationCap className="h-4 w-4" />;
  if (group === "announcements") return <Megaphone className="h-4 w-4" />;
  return <Bell className="h-4 w-4" />;
}
