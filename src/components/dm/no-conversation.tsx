import { MessagesSquare } from "lucide-react";

/** The messaging workspace's right pane on the inbox index, for every role. */
export function NoConversation() {
  return (
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
  );
}
