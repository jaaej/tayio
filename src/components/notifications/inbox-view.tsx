"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { loadAnnouncementForInbox } from "@/app/_actions/announcement-inbox";
import { buttonVariants } from "@/components/admin/ui/button";
import { GlassPanel } from "@/components/admin/ui/glass-panel";
import { PageHeader } from "@/components/admin/ui/page-header";
import {
  NOTIFICATION_GROUPS,
  notificationSections,
  type NotificationGroupKey,
  type NotificationWhen,
} from "@/lib/notification-groups";
import { formatDayMonth } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  finishNavigationLoading,
  startNavigationLoading,
} from "@/lib/navigation-loading";

/**
 * One row as the server hands it over. The time label ("3:12 pm", "Sun",
 * "20 Sep") and the Today / This week / Earlier bucket are resolved on the
 * server in Melbourne time, so the client never re-derives them against a
 * different clock or timezone and desyncs on hydration.
 */
export type InboxItem = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  /** Set on an announcement delivery, which opens in place to its full text. */
  announcementId: string | null;
  isUnread: boolean;
  isUrgent: boolean;
  group: NotificationGroupKey;
  when: NotificationWhen;
  createdAtIso: string;
  timeLabel: string;
};

type FilterKey = "all" | "unread" | "urgent" | NotificationGroupKey;

/** Filter dot, row kind label, icon tile and icon per group. Theme tokens only. */
const GROUP_STYLE: Record<
  NotificationGroupKey,
  { dot: string; text: string; tile: string; Icon: LucideIcon }
> = {
  messages: { dot: "bg-info", text: "text-info", tile: "bg-info-bg text-info", Icon: MessageCircle },
  action: { dot: "bg-warn", text: "text-warn", tile: "bg-warn-bg text-warn", Icon: AlertCircle },
  learning: { dot: "bg-good", text: "text-good", tile: "bg-good-bg text-good", Icon: BookOpen },
  announcements: {
    dot: "bg-brand-400",
    text: "text-brand-600",
    tile: "bg-brand-100 text-brand-600",
    Icon: Megaphone,
  },
  updates: { dot: "bg-muted-2", text: "text-ink-soft", tile: "bg-surface-3 text-ink-soft", Icon: Bell },
};

const ITEM_LABEL = Object.fromEntries(
  NOTIFICATION_GROUPS.map((group) => [group.key, group.itemLabel]),
) as Record<NotificationGroupKey, string>;

/**
 * Shared notification inbox for all four portals.
 *
 * One list in date order under Today, This week and Earlier, newest first,
 * every kind together; each row names its kind ("Message", "Action needed").
 * The filter pills narrow the list (unread, urgent, one kind) without
 * changing that order.
 *
 * Filtering is client-side: every row is already in the payload, so a pill tap
 * is instant and costs no extra query.
 *
 * `?announcement=<id>` (an announcement's notification or email link) opens
 * that announcement in full; `?filter=<group>` starts on one kind, so the
 * parent Overview can send "See all" to the announcements.
 */
export function NotificationsInboxView({ items }: { items: InboxItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkedAnnouncement = searchParams.get("announcement");
  const linked = linkedAnnouncement
    ? (items.find((item) => item.announcementId === linkedAnnouncement) ?? null)
    : null;
  const [filter, setFilter] = useState<FilterKey>(() => {
    const requested = searchParams.get("filter");
    return NOTIFICATION_GROUPS.some((g) => g.key === requested) ? (requested as FilterKey) : "all";
  });
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(linked ? [linked.id] : []),
  );
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const linkedRef = useRef<HTMLLIElement>(null);
  const openedLink = useRef(false);
  // A linked announcement older than the loaded rows is fetched on its own.
  const [olderAnnouncement, setOlderAnnouncement] = useState<{
    title: string;
    body: string;
    isUrgent: boolean;
    publishedAtIso: string;
  } | null>(null);

  useEffect(() => {
    if (!linkedAnnouncement || linked) return;
    let live = true;
    loadAnnouncementForInbox(linkedAnnouncement)
      .then((result) => {
        if (live && result.ok) setOlderAnnouncement(result.announcement);
      })
      .catch(() => {
        // Nothing to show beyond the inbox itself.
      });
    return () => {
      live = false;
    };
  }, [linkedAnnouncement, linked]);

  // Arriving on an announcement's link: bring it into view and mark it read.
  useEffect(() => {
    if (!linked || openedLink.current) return;
    openedLink.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    linkedRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    if (!linked.isUnread) return;
    setReadIds((current) => new Set(current).add(linked.id));
    markNotificationRead(linked.id)
      .then((result) => {
        if (result.ok) router.refresh();
      })
      .catch(() => {
        // The row stays unread on the server; it is marked again when opened.
      });
  }, [linked, router]);

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
    <div className="flex w-full max-w-[920px] flex-col gap-4">
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-baseline gap-x-2.5">
            Notifications
            {unread > 0 && (
              <span className="text-[14px] font-bold tabular-nums text-ink-soft">
                {unread > 99 ? "99+" : unread} unread
              </span>
            )}
          </span>
        }
        actions={
          unread > 0 ? (
            <form action={markAllNotificationsRead}>
              <button
                type="submit"
                className={buttonVariants({ variant: "glass", size: "lg" })}
              >
                Mark all read
              </button>
            </form>
          ) : undefined
        }
      />

      {olderAnnouncement && (
        <section aria-label="Announcement" className="glass rounded-[24px] p-1.5">
          <div className="panel flex items-start gap-3.5 bg-brand-50 px-[18px] py-3.5">
            <span
              aria-hidden
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-[10px]",
                olderAnnouncement.isUrgent ? "bg-bad-bg text-bad" : GROUP_STYLE.announcements.tile,
              )}
            >
              <Megaphone className="h-[17px] w-[17px]" strokeWidth={1.9} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[14px] font-semibold leading-snug text-ink">
                {olderAnnouncement.title}
              </span>
              <span className="whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">
                {olderAnnouncement.body}
              </span>
            </span>
            <time
              dateTime={olderAnnouncement.publishedAtIso}
              className="shrink-0 whitespace-nowrap text-[12px] tabular-nums text-ink-soft"
            >
              {formatDayMonth(new Date(olderAnnouncement.publishedAtIso))}
            </time>
          </div>
        </section>
      )}

      {displayedItems.length > 0 && (
        <div
          role="group"
          aria-label="Filter notifications"
          className="flex flex-wrap items-center gap-1.5"
        >
          {pills.map((pill) => {
            const isActive = pill.key === filter;
            const dot =
              pill.key === "all" || pill.key === "unread"
                ? null
                : pill.key === "urgent"
                  ? "bg-bad"
                  : GROUP_STYLE[pill.key].dot;
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => setFilter(pill.key)}
                aria-pressed={isActive}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-bold transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1",
                  isActive
                    ? "border-ink bg-ink text-white"
                    : "border-white/95 bg-white/70 text-ink hover:bg-white",
                )}
              >
                {dot && (
                  <span
                    aria-hidden
                    className={cn("h-2 w-2 rounded-full", isActive ? "bg-white" : dot)}
                  />
                )}
                {pill.label}
                <span
                  className={cn(
                    "text-[12px] tabular-nums",
                    isActive ? "text-white/75" : "text-ink-soft",
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
        <section aria-label="Notifications list" className="glass rounded-[24px] p-1.5">
          <div className="panel overflow-hidden">
            {sections.map((section, index) => (
              <Fragment key={section.key}>
                <h2
                  id={`notifications-${section.key}`}
                  className={cn(
                    "border-b border-line bg-surface-2 px-[18px] py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-soft",
                    index > 0 && "border-t",
                  )}
                >
                  {section.label}
                </h2>
                <ul
                  aria-labelledby={`notifications-${section.key}`}
                  className="divide-y divide-line"
                >
                  {section.items.map((item) => {
                    const style = GROUP_STYLE[item.group];
                    return (
                      <li
                        key={item.id}
                        ref={item.id === linked?.id ? linkedRef : undefined}
                        className={cn(
                          "scroll-mt-24",
                          item.id === linked?.id && "bg-brand-50",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => openNotification(item)}
                          disabled={pendingIds.has(item.id)}
                          aria-label={`${item.isUnread ? "Open unread" : "Open"} notification: ${item.title}`}
                          aria-expanded={
                            item.href ? undefined : expandedIds.has(item.id)
                          }
                          className="block w-full text-left transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none"
                        >
                          <Row
                            item={item}
                            expanded={expandedIds.has(item.id)}
                            tile={item.isUrgent ? "bg-bad-bg text-bad" : style.tile}
                            Icon={item.isUrgent ? AlertCircle : style.Icon}
                            kind={ITEM_LABEL[item.group]}
                            kindClass={style.text}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Fragment>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Row({
  item,
  expanded,
  tile,
  Icon,
  kind,
  kindClass,
}: {
  item: InboxItem;
  expanded: boolean;
  tile: string;
  Icon: LucideIcon;
  kind: string;
  kindClass: string;
}) {
  return (
    <span className="flex items-center gap-3.5 px-[18px] py-3.5">
      <span
        aria-hidden
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center self-start rounded-[10px]",
          tile,
        )}
      >
        <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
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
              "text-[13px] leading-relaxed text-ink-soft",
              expanded ? "whitespace-pre-line" : "line-clamp-2 sm:line-clamp-1",
            )}
          >
            {item.body}
          </span>
        )}
        <span className={cn("text-[12px] font-bold sm:hidden", kindClass)}>{kind}</span>
      </span>
      <span
        className={cn(
          "hidden w-[110px] shrink-0 text-right text-[12px] font-bold sm:block",
          kindClass,
        )}
      >
        {kind}
      </span>
      <span className="flex w-[64px] shrink-0 items-center justify-end gap-1">
        {!item.href && (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted transition-transform",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
        )}
        <time
          dateTime={item.createdAtIso}
          className="whitespace-nowrap text-[12px] tabular-nums text-ink-soft"
        >
          {item.timeLabel}
        </time>
      </span>
      <span className="grid w-2 shrink-0 place-items-center">
        {item.isUnread && (
          <span aria-hidden className="h-2 w-2 rounded-full bg-info" />
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
