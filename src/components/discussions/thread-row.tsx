import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ThreadSummary } from "@/lib/discussions-queries";

export function ThreadRow({
  thread,
  hrefPrefix,
}: {
  thread: ThreadSummary;
  hrefPrefix: string;
}) {
  const deleted = thread.deletedAt !== null;
  const title = deleted ? "[removed by admin]" : thread.title;
  const activity = thread.lastActivityAt.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });

  return (
    <Link
      href={`${hrefPrefix}/${thread.id}`}
      className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-brand-50/40"
    >
      <div className="min-w-0 flex-1">
        <div className="text-base font-semibold text-ink line-clamp-1 leading-snug">
          {title}
        </div>
        <div className="mt-1 text-xs text-ink-soft truncate">
          <span className="font-medium">{thread.authorName}</span>
          <span className="text-muted"> · {thread.authorRole}</span>
        </div>
      </div>
      <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
        <span className="text-xs uppercase tracking-[0.12em] tabular-nums text-ink-soft font-medium">
          {thread.replyCount} {thread.replyCount === 1 ? "reply" : "replies"}
        </span>
        <span className="text-[11px] uppercase tracking-[0.12em] tabular-nums text-muted">
          {activity}
        </span>
      </div>
      <ChevronRight
        className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 shrink-0"
        aria-hidden
      />
    </Link>
  );
}
