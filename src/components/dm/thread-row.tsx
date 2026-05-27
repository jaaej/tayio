import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ThreadInboxRow } from "@/lib/dm-queries";

export function ThreadRow({
  thread,
  hrefPrefix,
}: {
  thread: ThreadInboxRow;
  hrefPrefix: string;
}) {
  const stamp = thread.lastActivityAt.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
  return (
    <Link
      href={`${hrefPrefix}/${thread.threadId}`}
      className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-brand-50/40"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-ink line-clamp-1">
            {thread.otherName}
          </span>
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted font-medium">
            {thread.otherRole}
          </span>
          {thread.unread && (
            <span
              aria-label="Unread"
              className="ml-1 inline-block h-2 w-2 rounded-full bg-brand-600"
            />
          )}
        </div>
        {thread.lastMessagePreview && (
          <div className="mt-1 text-sm text-ink-soft line-clamp-1">
            {thread.lastMessagePreview}
          </div>
        )}
      </div>
      <div className="text-[11px] uppercase tracking-[0.12em] tabular-nums text-muted shrink-0">
        {stamp}
      </div>
      <ChevronRight
        className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 shrink-0"
        aria-hidden
      />
    </Link>
  );
}
