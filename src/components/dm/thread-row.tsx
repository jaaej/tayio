import Link from "next/link";
import type { ThreadInboxRow } from "@/lib/dm-queries";
import { initialOf, roleColor } from "./dm-visuals";

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
  const color = roleColor(thread.otherRole);

  return (
    <Link
      href={`${hrefPrefix}/${thread.threadId}`}
      className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-2"
    >
      <div className="relative shrink-0">
        <span
          className="grid h-11 w-11 place-items-center rounded-full text-[15px] font-bold text-white shadow-[0_4px_12px_-5px_rgba(31,40,90,0.5)]"
          style={{ background: color }}
        >
          {initialOf(thread.otherName)}
        </span>
        {thread.unread && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-surface bg-brand-600"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={
              "truncate text-[15px] text-ink " +
              (thread.unread ? "font-extrabold" : "font-semibold")
            }
          >
            {thread.otherName}
          </span>
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
            style={{ background: `${color}1a`, color }}
          >
            {thread.otherRole}
          </span>
          <span
            className={
              "ml-auto shrink-0 text-[11px] tabular-nums " +
              (thread.unread ? "font-bold text-brand-700" : "text-muted")
            }
          >
            {stamp}
          </span>
        </div>
        <div
          className={
            "mt-0.5 truncate text-[13px] " +
            (thread.unread ? "font-semibold text-ink-soft" : "text-muted")
          }
        >
          {thread.lastMessagePreview ?? "No messages yet"}
        </div>
      </div>
    </Link>
  );
}
