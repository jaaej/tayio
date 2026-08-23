"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, Bell, CheckCheck } from "lucide-react";
import { markAllNotificationsRead } from "@/app/_actions/notifications";
import { PageHero } from "@/components/ui/page-hero";
import {
  NOTIFICATION_GROUPS,
  NOTIFICATION_TIME_BUCKETS,
  type NotificationGroupKey,
  type NotificationTimeBucket,
} from "@/lib/notification-groups";
import { cn } from "@/lib/utils";

/**
 * One row as the server hands it over. Everything time-dependent (the bucket,
 * the "2h ago" label) is resolved server-side so the client never re-derives it
 * against a different clock or timezone and desyncs on hydration.
 */
export type InboxItem = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  isUnread: boolean;
  group: NotificationGroupKey;
  bucket: NotificationTimeBucket;
  createdAtIso: string;
  timeLabel: string;
};

type FilterKey = "all" | "unread" | NotificationGroupKey;

/**
 * Shared notification inbox for all four portals.
 *
 * Sections are chronological (Today / This week / Earlier) because that is how
 * an inbox is read; the kind of notification is a filter instead of a section,
 * so Messages and Action needed stay one tap away without splintering the list
 * into five short stacks. Action items also carry an inline chip so they stay
 * identifiable inside a mixed, time-ordered list.
 *
 * Filtering is client-side: every row is already in the payload, so a pill tap
 * is instant and costs no extra query.
 */
export function NotificationsInboxView({ items }: { items: InboxItem[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const unread = items.filter((item) => item.isUnread).length;
  const counts = {
    all: items.length,
    unread,
    ...Object.fromEntries(
      NOTIFICATION_GROUPS.map((group) => [
        group.key,
        items.filter((item) => item.group === group.key).length,
      ]),
    ),
  } as Record<FilterKey, number>;

  const allPills: Array<{ key: FilterKey; label: string }> = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread" },
    ...NOTIFICATION_GROUPS,
  ];
  // Keep the active pill even once its last item is read away, so the row never
  // reshuffles underneath the finger that just tapped it.
  const pills = allPills.filter(
    (pill) => pill.key === "all" || pill.key === filter || counts[pill.key] > 0,
  );

  const visible =
    filter === "all"
      ? items
      : filter === "unread"
        ? items.filter((item) => item.isUnread)
        : items.filter((item) => item.group === filter);

  const sections = NOTIFICATION_TIME_BUCKETS.map((bucket) => ({
    ...bucket,
    items: visible.filter((item) => item.bucket === bucket.key),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="w-full space-y-6">
      <PageHero
        eyebrow="Notifications"
        title="Inbox"
        actions={
          unread > 0 ? (
            <form action={markAllNotificationsRead}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-[13px] font-bold text-brand-800 shadow-[0_10px_24px_-14px_rgba(15,20,60,0.8)] transition-transform duration-150 hover:-translate-y-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <CheckCheck className="h-4 w-4" aria-hidden />
                Mark all read
              </button>
            </form>
          ) : undefined
        }
      />

      {/* Filters sit with the list they act on, not with the hero: the tighter
          gap here than above is what tells you which one they belong to. */}
      <div className="space-y-4">
        {items.length > 0 && (
          <div
            role="group"
            aria-label="Filter notifications"
            className="flex flex-wrap items-center gap-1.5 px-1"
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
                    "inline-flex min-h-9 items-center gap-2 rounded-full border px-4 text-[12px] font-bold transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
                    isActive
                      ? "border-ink bg-ink text-white"
                      : "border-line-strong bg-surface text-ink hover:border-brand-500 hover:text-brand-700",
                  )}
                >
                  {pill.label}
                  <span
                    className={cn(
                      "text-[11px] font-extrabold tabular-nums",
                      isActive
                        ? "text-white/70"
                        : pill.key === "action" && counts.action > 0
                          ? "text-bad"
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

        {items.length === 0 ? (
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
                className="mt-3 inline-flex min-h-9 items-center rounded-full border border-line-strong bg-surface px-4 text-[12px] font-bold text-ink transition-colors hover:border-brand-500 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                Show all
              </button>
            }
          />
        ) : (
          <div className="space-y-6">
            {sections.map((section) => (
              <section key={section.key} aria-labelledby={`notifications-${section.key}`}>
                <div className="mb-2.5 flex items-center gap-3 px-1">
                  <h2
                    id={`notifications-${section.key}`}
                    className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-ink-soft"
                  >
                    {section.label}
                  </h2>
                  <div aria-hidden className="h-px min-w-8 flex-1 bg-line" />
                </div>

                <div className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-[0_12px_30px_-26px_rgba(31,40,90,0.34)]">
                  <ul className="divide-y divide-line">
                    {section.items.map((item) => (
                      <li key={item.id}>
                        {item.href ? (
                          <Link
                            href={item.href}
                            className="block transition-colors duration-200 hover:bg-brand-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 motion-reduce:transition-none"
                          >
                            <Row item={item} />
                          </Link>
                        ) : (
                          <Row item={item} />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ item }: { item: InboxItem }) {
  return (
    <div className="flex min-h-[76px] items-start gap-3 px-4 py-3.5 sm:px-5">
      <span
        aria-hidden
        className={cn(
          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
          item.isUnread ? "bg-brand-500" : "bg-line-strong",
        )}
      />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-[14px] leading-snug",
            item.isUnread
              ? "font-extrabold text-ink"
              : "font-semibold text-ink-soft",
          )}
        >
          {item.isUnread && <span className="sr-only">Unread. </span>}
          {item.title}
        </div>
        {item.body && (
          <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-relaxed text-muted">
            {item.body}
          </p>
        )}
        {item.group === "action" && (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-bad-bg px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-bad">
            <AlertCircle className="h-3 w-3" aria-hidden />
            Action needed
          </span>
        )}
      </div>
      <time
        dateTime={item.createdAtIso}
        className="shrink-0 pt-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted tabular-nums"
      >
        {item.timeLabel}
      </time>
    </div>
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
    <div className="grid min-h-56 place-items-center rounded-[20px] border-2 border-dashed border-line bg-surface p-6 text-center">
      <div>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-[14px] bg-surface-2 text-muted">
          <Bell className="h-5 w-5" />
        </span>
        <h2 className="mt-3 text-[16px] font-extrabold text-ink">{title}</h2>
        <p className="mt-1 text-[12px] font-semibold text-muted">{message}</p>
        {action}
      </div>
    </div>
  );
}
