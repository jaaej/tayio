import Link from "next/link";
import type { ThreadSummary } from "@/lib/discussions-queries";
import { SubjectDot } from "@/components/admin/ui/glass";
import { relativeShort, roleLabel } from "./role-tone";

/**
 * One thread row inside a white panel. Shared by the board page and the
 * landing page's recent activity list so a thread reads the same wherever it
 * is surfaced - only the board line differs, since on a board page you
 * already know which board you're on.
 */
export function ThreadRow({
  thread,
  href,
  boardLabel,
  boardColor = null,
}: {
  thread: ThreadSummary;
  href: string;
  /** Set only where threads from several boards are mixed together. */
  boardLabel?: string;
  /** The board subject's stored colour; null on General help. */
  boardColor?: string | null;
}) {
  const deleted = thread.deletedAt !== null;
  const title = deleted ? "[removed by admin]" : thread.title;
  const when = relativeShort(thread.lastActivityAt);
  const replies = `${thread.replyCount} ${thread.replyCount === 1 ? "reply" : "replies"}`;

  return (
    <Link
      href={href}
      className="flex flex-col gap-1 px-4 py-3.5 text-ink transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
    >
      {boardLabel && (
        <span className="flex items-center gap-1.5 text-[12px] text-muted">
          <SubjectDot subject={boardLabel} color={boardColor} className="h-2 w-2" />
          <span className="min-w-0 truncate">{boardLabel}</span>
          <span className="ml-auto shrink-0 tabular-nums">{when}</span>
        </span>
      )}
      <span
        className={
          deleted
            ? "text-[14px] font-bold italic leading-snug text-muted"
            : "line-clamp-2 text-[14px] font-bold leading-snug"
        }
      >
        {title}
      </span>
      <span className="text-[12px] text-muted">
        {thread.authorName} · {roleLabel(thread.authorRole)} · {replies}
        {!boardLabel && <> · {when}</>}
      </span>
    </Link>
  );
}
