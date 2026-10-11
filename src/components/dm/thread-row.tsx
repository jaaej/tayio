import Link from "next/link";
import type { ThreadInboxRow } from "@/lib/dm-queries";
import { inboxStamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { initialsOf, roleAvatarClass, shortRoleLabel } from "./dm-visuals";

export function ThreadRow({
  thread,
  hrefPrefix,
  active,
}: {
  thread: ThreadInboxRow;
  hrefPrefix: string;
  active: boolean;
}) {
  // React Server Components serialize Date values before this client-side row
  // receives them. Normalise both the server Date and browser ISO-string forms.
  const lastActivityAt =
    thread.lastActivityAt instanceof Date
      ? thread.lastActivityAt
      : new Date(thread.lastActivityAt);
  // The open thread has just been marked read; never show it as unread.
  const unread = thread.unread && !active;

  return (
    <Link
      href={`${hrefPrefix}/${thread.threadId}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex gap-2.5 rounded-[12px] p-2.5 text-ink transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400",
        active ? "bg-surface-3" : "hover:bg-surface-2",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full text-[12px] font-extrabold",
          roleAvatarClass(thread.otherRole),
        )}
      >
        {initialsOf(thread.otherName)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span
            className={cn(
              "truncate text-[14px]",
              unread ? "font-extrabold" : "font-bold",
            )}
          >
            {thread.otherName}
          </span>
          <span className="shrink-0 text-[11px] text-muted">
            {shortRoleLabel(thread.otherRole)}
          </span>
          <time
            dateTime={lastActivityAt.toISOString()}
            suppressHydrationWarning
            className="ml-auto shrink-0 text-[11px] tabular-nums text-muted"
          >
            {inboxStamp(lastActivityAt)}
          </time>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[13px]",
              unread ? "font-semibold text-ink" : "text-muted",
            )}
          >
            {thread.lastMessagePreview ?? "No messages yet"}
          </span>
          {unread && (
            <>
              <span
                aria-hidden
                className="h-[9px] w-[9px] shrink-0 rounded-full bg-brand-500"
              />
              <span className="sr-only">Unread</span>
            </>
          )}
        </span>
      </span>
    </Link>
  );
}
