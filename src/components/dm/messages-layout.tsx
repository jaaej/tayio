"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import type { ThreadInboxRow } from "@/lib/dm-queries";
import { cn } from "@/lib/utils";
import { InboxCompose, type DmGroup } from "./inbox-compose";

/**
 * Shared two-pane messaging workspace for every role, rendered by each role's
 * messages layout: the inbox list on the left, the open conversation on the
 * right. Being a layout, it stays mounted while the conversation changes, so
 * switching people swaps only the right pane's contents. On phones it
 * collapses to one screen at a time - the list at /messages, the conversation
 * at /messages/[threadId] (with a back button in its header).
 */
export function MessagesLayout({
  threads,
  groups,
  hrefPrefix,
  children,
}: {
  threads: ThreadInboxRow[];
  groups: DmGroup[];
  hrefPrefix: string;
  /** The open conversation, or the empty state on the inbox index. */
  children: ReactNode;
}) {
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  // "with/[userId]" only redirects to a thread, so it never counts as open.
  const activeThreadId = segment && segment !== "with" ? segment : undefined;
  const open = Boolean(activeThreadId);

  // A layout is not re-rendered when only the conversation changes, so the
  // list (and the sidebar's unread badge) would still count a thread that
  // opening it just marked read, and would miss a thread just started. Ask
  // the server for fresh data once in either case.
  const refreshedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!activeThreadId || refreshedFor.current === activeThreadId) return;
    const row = threads.find((t) => t.threadId === activeThreadId);
    if (row && !row.unread) return;
    refreshedFor.current = activeThreadId;
    router.refresh();
  }, [activeThreadId, threads, router]);

  return (
    // Desktop: fill the viewport below the portal's top offset so each pane
    // scrolls on its own; phones use normal page flow.
    <div className="flex min-w-0 items-stretch gap-5 lg:h-[var(--portal-fill-h)] lg:min-h-[540px]">
      <InboxCompose
        threads={threads}
        groups={groups}
        hrefPrefix={hrefPrefix}
        activeThreadId={activeThreadId}
        className={cn(
          "w-full lg:flex lg:w-[320px] lg:shrink-0 xl:w-[370px]",
          open ? "hidden" : "flex",
        )}
      />
      <div
        className={cn(
          "glass min-w-0 flex-1 flex-col rounded-[24px] p-1.5",
          open ? "flex h-[calc(100dvh-160px)] min-h-[420px] lg:h-auto lg:min-h-0" : "hidden lg:flex",
        )}
      >
        {children}
      </div>
    </div>
  );
}
