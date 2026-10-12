"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { relativeTime } from "@/lib/format";
import {
  AlertCircle,
  Bell,
  BookOpen,
  ChevronDown,
  Megaphone,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/_actions/notifications";
import { buttonVariants } from "@/components/admin/ui/button";
import { GlassPanel } from "@/components/admin/ui/glass-panel";
import { PageHeader } from "@/components/admin/ui/page-header";
import {
  NOTIFICATION_GROUPS,
  notificationSections,
  type NotificationGroupKey,
} from "@/lib/notification-groups";
import { cn } from "@/lib/utils";
import {
  finishNavigationLoading,
  startNavigationLoading,
} from "@/lib/navigation-loading";

/**
 * One row as the server hands it over. The time label is resolved on the
 * server in Melbourne time, so the client never re-derives it against a
 * different clock or timezone and desyncs on hydration.
 */
export type InboxItem = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  isUnread: boolean;
  isUrgent: boolean;
  group: NotificationGroupKey;
  createdAtIso: string;
  timeLabel: string;
};

type FilterKey = "all" | "unread" | "urgent" | NotificationGroupKey;

/** Section dot, row icon tile and icon per group. Theme tokens only. */
const GROUP_STYLE: Record<
  NotificationGroupKey,
  { dot: string; tile: string; Icon: LucideIcon }
> = {
  messages: { dot: "bg-info", tile: "bg-info-bg text-info", Icon: MessageCircle },
  action: { dot: "bg-sun-500", tile: "bg-warn-bg text-warn", Icon: AlertCircle },
  learning: { dot: "bg-good", tile: "bg-good-bg text-good", Icon: BookOpen },
  announcements: {
    dot: "bg-brand-400",
    tile: "bg-brand-100 text-brand-600",
    Icon: Megaphone,
  },
  updates: { dot: "bg-muted-2", tile: "bg-surface-3 text-ink-soft", Icon: Bell },
};

/**
 * Shared notification inbox for all four portals.
 *
 * One labelled section per kind, in NOTIFICATION_GROUPS order: direct messages
 * and action items always sit above learning updates, announcements and other
 * updates; each section is newest first. The filter pills narrow the list
 * (unread, urgent, one kind) without changing that order.
 *
 * Filtering is client-side: every row is already in the payload, so a pill tap
 * is instant and costs no extra query.
 */
export function NotificationsInboxView({
  items,
  showUnreadCallout = true,
}: {
  items: InboxItem[];
  showUnreadCallout?: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

  const displayedItems = items.map((item) =>
    readIds.has(item.id) ? { ...item, isUnread: false } : item,
  );

  const unread = displayedItems.filter((item) => item.isUnread).length;
  const counts = {
    all: displayedItems.length,
    unread,
    urgent: displayedItems.filter((item) => item.isUrgent).length,
    ...Object.fromEntries(
      NOTIFICATION_GROUPS.map((group) => [
        group.key,
        displayedItems.filter((item) => item.group === group.key).length,
      ]),
    ),
  } as Record<FilterKey, number>;

  const allPills: Array<{ key: FilterKey; label: string }> = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread" },
    { key: "urgent", label: "Urgent" },
    ...NOTIFICATION_GROUPS,
  ];
  // Keep the active pill even once its last item is read away, so the row never
  // reshuffles underneath the finger that just tapped it.
  const pills = allPills.filter(
    (pill) => pill.key === "all" || pill.key === filter || counts[pill.key] > 0,
  );

  const visible =
    filter === "all"
      ? displayedItems
      : filter === "unread"
        ? displayedItems.filter((item) => item.isUnread)
        : filter === "urgent"
          ? displayedItems.filter((item) => item.isUrgent)
          : displayedItems.filter((item) => item.group === filter);

  const sections = notificationSections(visible);

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function openNotification(item: InboxItem) {
    if (!item.href) toggleExpanded(item.id);
    if (item.href) startNavigationLoading();

    if (!item.isUnread || readIds.has(item.id)) {
      if (item.href) router.push(item.href);
      return;
    }

    setReadIds((current) => new Set(current).add(item.id));
    setPendingIds((current) => new Set(current).add(item.id));

    try {
      const result = await markNotificationRead(item.id);
      if (!result.ok) {
        if (item.href) finishNavigationLoading();
        setReadIds((current) => {
          const next = new Set(current);
          next.delete(item.id);
          return next;
        });
        return;
      }

      if (item.href) {
        router.push(item.href);
      } else {
        // Rows without a destination stay on this page, so refresh the shell's
        // unread badge after their read state is persisted.
        router.refresh();
      }
    } catch {
      if (item.href) finishNavigationLoading();
      setReadIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <PageHeader
        title="Notifications"
        actions={
          unread > 0 ? (
            <>
              {showUnreadCallout && filter !== "unread" && (
                <button
                  type="button"
                  onClick={() => setFilter("unread")}
                  className="inline-flex h-[42px] items-center gap-2 rounded-[12px] bg-bad px-4 text-[14px] font-bold text-white transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bad focus-visible:ring-offset-1"
                >
                  <Bell className="h-4 w-4" aria-hidden />
                  New notifications
                  <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-extrabold tabular-nums text-bad">
                    {unread > 99 ? "99+" : unread}
                  </span>
                </button>
              )}
              <form action={markAllNotificationsRead}>
                <button
                  type="submit"
                  className={buttonVariants({ variant: "glass", size: "lg" })}
                >
                  Mark all read
                </button>
              </form>
            </>
          ) : undefined
        }
      />

      {displayedItems.length > 0 && (
        <div
          role="group"
          aria-label="Filter notifications"
          className="flex flex-wrap items-center gap-1.5"
        >
          {pills.map((pill) => {
            const isActive = pill.key === filter;
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => setFilter(pill.key)}
                aria-pressed={isActive}
                className={cn(
                  "inline-flex h-[34px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-bold transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1",
                  isActive
                    ? "border-ink bg-ink text-white"
                    : "border-white/95 bg-white/70 text-ink hover:bg-white",
                )}
              >
                {pill.label}
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    isActive
                      ? "text-white/75"
                      : pill.key === "action" && counts.action > 0
                        ? "font-extrabold text-bad"
                        : "text-muted",
                  )}
                >
                  {counts[pill.key]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {displayedItems.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          message="New messages and updates will appear here."
        />
      ) : sections.length === 0 ? (
        <EmptyState
          title="Nothing in this filter"
          message="Try another filter to see the rest of your notifications."
          action={
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                buttonVariants({ variant: "outline", size: "md" }),
                "mt-3",
              )}
            >
              Show all
            </button>
          }
        />
      ) : (
        sections.map((section) => {
          const style = GROUP_STYLE[section.key];
          return (
            <GlassPanel
              key={section.key}
              titleId={`notifications-${section.key}`}
              title={
                <span className="inline-flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className={cn("h-[9px] w-[9px] rounded-full", style.dot)}
                  />
                  {section.label}
                </span>
              }
              meta={section.items.length}
            >
              <ul className="divide-y divide-line">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openNotification(item)}
                      disabled={pendingIds.has(item.id)}
                      aria-label={`${item.isUnread ? "Open unread" : "Open"} notification: ${item.title}`}
                      aria-expanded={
                        item.href ? undefined : expandedIds.has(item.id)
                      }
                      className={cn(
                        "block w-full text-left transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none",
                        item.isUnread && "bg-brand-50/60",
                      )}
                    >
                      <Row
                        item={item}
                        expanded={expandedIds.has(item.id)}
                        tile={item.isUrgent ? "bg-bad-bg text-bad" : style.tile}
                        Icon={item.isUrgent ? AlertCircle : style.Icon}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </GlassPanel>
          );
        })
      )}
    </div>
  );
}

function Row({
  item,
  expanded,
  tile,
  Icon,
}: {
  item: InboxItem;
  expanded: boolean;
  tile: string;
  Icon: LucideIcon;
}) {
  return (
    <span className="flex items-start gap-3 px-4 py-3.5">
      <span
        aria-hidden
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-[11px]",
          tile,
        )}
      >
        <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "text-[14px] leading-snug text-ink",
              item.isUnread ? "font-extrabold" : "font-semibold",
            )}
          >
            {item.isUnread && <span className="sr-only">Unread. </span>}
            {item.title}
          </span>
          {item.isUrgent && (
            <span className="inline-flex h-5 items-center rounded-full bg-bad-bg px-2 text-[11px] font-extrabold text-bad">
              Urgent
            </span>
          )}
        </span>
        {item.body && (
          <span
            className={cn(
              "text-[13px] leading-relaxed text-muted",
              !expanded && "line-clamp-2",
            )}
          >
            {item.body}
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
        <time
          dateTime={item.createdAtIso}
          className="whitespace-nowrap text-[12px] tabular-nums text-muted"
        >
          <LiveRelativeTime
            createdAtIso={item.createdAtIso}
            initialLabel={item.timeLabel}
          />
        </time>
        {item.isUnread && (
          <span aria-hidden className="h-[9px] w-[9px] rounded-full bg-brand-500" />
        )}
        {!item.href && (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted transition-transform",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
        )}
      </span>
    </span>
  );
}

function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <GlassPanel bodyClassName="grid min-h-56 place-items-center p-6 text-center">
      <div>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-[14px] bg-surface-2 text-muted">
          <Bell className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="mt-3 text-[16px] font-extrabold text-ink">{title}</h2>
        <p className="mt-1 text-[13px] font-medium text-muted">{message}</p>
        {action}
      </div>
    </GlassPanel>
  );
}

/** "5m ago" style time that keeps ticking while the inbox is open. */
function LiveRelativeTime({
  createdAtIso,
  initialLabel,
}: {
  createdAtIso: string;
  initialLabel: string;
}) {
  const [label, setLabel] = useState(initialLabel);

  useEffect(() => {
    const update = () => setLabel(relativeTime(new Date(createdAtIso)));
    update();

    // Align the first tick to the next wall-clock minute, then update once per
    // minute, so 5m becomes 6m at the right moment rather than up to a minute
    // late depending on when the page mounted.
    let interval: ReturnType<typeof setInterval> | undefined;
    const delay = 60_000 - (Date.now() % 60_000) + 25;
    const timeout = setTimeout(() => {
      update();
      interval = setInterval(update, 60_000);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [createdAtIso]);

  return label;
}
