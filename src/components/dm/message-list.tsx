import { MessagesSquare } from "lucide-react";
import type { MessageRow } from "@/lib/dm-queries";
import {
  conversationDayLabel,
  formatClockTime,
  melbourneDayKey,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export function MessageList({
  messages,
  meId,
  otherName,
}: {
  messages: MessageRow[];
  meId: string;
  /** Read out before the other person's messages for screen readers. */
  otherName: string;
}) {
  if (messages.length === 0) {
    return (
      <div className="grid flex-1 place-items-center py-12 text-center">
        <div>
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-muted">
            <MessagesSquare className="h-6 w-6" aria-hidden />
          </div>
          <div className="mt-3 text-[14px] font-bold text-ink">
            No messages yet
          </div>
          <div className="text-[13px] text-muted">Say hi to get started.</div>
        </div>
      </div>
    );
  }

  const now = new Date();

  return (
    <ol className="flex flex-col gap-2.5">
      {messages.map((m, i) => {
        const isMe = m.senderId === meId;
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const day = melbourneDayKey(m.createdAt);
        const newDay = !prev || melbourneDayKey(prev.createdAt) !== day;
        const clock = formatClockTime(m.createdAt);
        // One stamp per burst: skip it while the same sender keeps writing
        // within the same minute.
        const showTime =
          !next ||
          next.senderId !== m.senderId ||
          formatClockTime(next.createdAt) !== clock;

        return (
          <li key={m.id} className="flex flex-col gap-2.5">
            {newDay && (
              <span className="self-center rounded-[10px] bg-surface-2 px-2.5 py-1 text-[12px] font-bold text-muted">
                {conversationDayLabel(m.createdAt, now)}
              </span>
            )}
            <div
              className={cn(
                "flex max-w-[85%] flex-col gap-[3px] sm:max-w-[70%]",
                isMe ? "items-end self-end" : "items-start self-start",
              )}
            >
              <p
                className={cn(
                  "whitespace-pre-wrap break-words rounded-[16px] px-3.5 py-2.5 text-[14px] leading-normal",
                  isMe
                    ? "rounded-br-[4px] bg-ink text-white"
                    : "rounded-bl-[4px] bg-surface-3 text-ink",
                )}
              >
                <span className="sr-only">{isMe ? "You" : otherName}: </span>
                {m.body}
              </p>
              {showTime && (
                <time
                  dateTime={m.createdAt.toISOString()}
                  className="text-[11px] tabular-nums text-muted"
                >
                  {clock}
                </time>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
