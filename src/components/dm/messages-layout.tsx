import type { ReactNode } from "react";
import { MessagesSquare } from "lucide-react";
import type { ThreadInboxRow } from "@/lib/dm-queries";
import { cn } from "@/lib/utils";
import { InboxCompose, type DmGroup } from "./inbox-compose";

/**
 * Shared two-pane messaging workspace for every role: the inbox list on the
 * left, the open conversation on the right. On phones it collapses to one
 * screen at a time - the list at /messages, the conversation at
 * /messages/[threadId] (with a back button in its header).
 */
export function MessagesLayout({
  threads,
  groups,
  hrefPrefix,
  activeThreadId,
  children,
}: {
  threads: ThreadInboxRow[];
  groups: DmGroup[];
  hrefPrefix: string;
  activeThreadId?: string;
  /** The open conversation; omitted on the inbox index. */
  children?: ReactNode;
}) {
  const open = Boolean(activeThreadId);
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
      <div className={cn("min-w-0 flex-1", open ? "flex" : "hidden lg:flex")}>
        {children ?? <NoConversation />}
      </div>
    </div>
  );
}

function NoConversation() {
  return (
    <div className="glass flex w-full flex-col rounded-[24px] p-1.5">
      <div className="panel grid flex-1 place-items-center p-6 text-center">
        <div>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-muted">
            <MessagesSquare className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-3 text-[15px] font-bold text-ink">
            No conversation open
          </p>
          <p className="mt-0.5 text-[13px] text-muted">
            Pick someone from the list, or start a new message.
          </p>
        </div>
      </div>
    </div>
  );
}
