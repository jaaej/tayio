import Link from "next/link";
import type { AccentTokens } from "@/lib/subject-colors";
import type { ThreadSummary } from "@/lib/discussions-queries";
import { initialOf, relativeShort, roleColor } from "./role-tone";

/**
 * One thread row. Shared by the board page and the landing page's recent
 * activity list so a thread reads the same wherever it is surfaced - only the
 * board chip differs, since on a board page you already know which board
 * you're on.
 */
export function ThreadCard({
  thread,
  href,
  tokens,
  boardLabel,
}: {
  thread: ThreadSummary;
  href: string;
  tokens: AccentTokens;
  /** Set only where threads from several boards are mixed together. */
  boardLabel?: string;
}) {
  const deleted = thread.deletedAt !== null;
  const title = deleted ? "[removed by admin]" : thread.title;
  const hasReplies = thread.replyCount > 0;

  return (
    <Link
      href={href}
      className="group block bg-surface border border-line rounded-[20px] px-6 py-5 transition-all duration-150 hover:-translate-y-[2px] hover:border-line-strong hover:shadow-[0_18px_38px_-22px_rgba(31,40,90,0.30)]"
    >
      <div className="flex items-start gap-4">
        <div
          className="h-[44px] w-[44px] rounded-full grid place-items-center text-[15px] font-bold text-white shrink-0"
          style={{ background: roleColor(thread.authorRole) }}
        >
          {initialOf(thread.authorName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-bold text-ink leading-snug tracking-[-0.01em] line-clamp-2">
            {title}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[12px] flex-wrap">
            {/* Outlined, where the role pill is filled: two filled chips of the
                same accent would read as one blob and flatten the hierarchy. */}
            {boardLabel && (
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-bold"
                style={{ borderColor: tokens.ring, color: tokens.arrow }}
              >
                {boardLabel}
              </span>
            )}
            <span className="font-bold text-ink-soft truncate">
              {thread.authorName}
            </span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ background: tokens.pillBg, color: tokens.pillText }}
            >
              {thread.authorRole}
            </span>
            <span className="text-muted font-semibold">·</span>
            <span className="text-muted font-semibold tabular-nums">
              {relativeShort(thread.lastActivityAt)}
            </span>
          </div>
        </div>
        <div
          className="hidden sm:flex flex-col items-center justify-center min-w-[68px] rounded-[14px] px-3 py-2.5 shrink-0"
          style={{
            background: hasReplies ? tokens.bgFrom : "var(--surface-2)",
            color: hasReplies ? tokens.arrow : "var(--muted)",
          }}
        >
          <div className="text-[22px] font-bold tabular-nums leading-none tracking-[-0.02em]">
            {thread.replyCount}
          </div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.14em] font-bold">
            {thread.replyCount === 1 ? "reply" : "replies"}
          </div>
        </div>
      </div>
    </Link>
  );
}
