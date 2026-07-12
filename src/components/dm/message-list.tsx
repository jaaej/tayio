import { MessagesSquare } from "lucide-react";
import type { UserRole } from "@/db/schema";
import type { MessageRow } from "@/lib/dm-queries";
import { initialOf, roleColor } from "./dm-visuals";

export function MessageList({
  messages,
  meId,
  otherName = "",
  otherRole = "student",
}: {
  messages: MessageRow[];
  meId: string;
  otherName?: string;
  otherRole?: UserRole;
}) {
  if (messages.length === 0) {
    return (
      <div className="grid place-items-center py-12 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-muted">
          <MessagesSquare className="h-6 w-6" aria-hidden />
        </div>
        <div className="mt-3 text-[14px] font-semibold text-ink">
          No messages yet
        </div>
        <div className="text-[13px] text-muted">Say hi to get started.</div>
      </div>
    );
  }

  const otherColor = roleColor(otherRole);

  return (
    <div className="space-y-1.5">
      {messages.map((m, i) => {
        const isMe = m.senderId === meId;
        const prev = messages[i - 1];
        const startOfGroup = !prev || prev.senderId !== m.senderId;
        const stamp = m.createdAt.toLocaleTimeString("en-AU", {
          hour: "numeric",
          minute: "2-digit",
        });

        return (
          <div
            key={m.id}
            className={
              "flex items-end gap-2 " +
              (isMe ? "justify-end" : "justify-start") +
              (startOfGroup ? " mt-3 first:mt-0" : "")
            }
          >
            {!isMe &&
              (startOfGroup ? (
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: otherColor }}
                >
                  {initialOf(otherName)}
                </span>
              ) : (
                <span aria-hidden className="w-7 shrink-0" />
              ))}

            <div
              className={
                "max-w-[78%] px-3.5 py-2 text-[15px] leading-relaxed whitespace-pre-wrap shadow-[0_1px_2px_rgba(15,17,30,0.05)] " +
                (isMe
                  ? "rounded-2xl rounded-br-md text-white"
                  : "rounded-2xl rounded-bl-md border border-line bg-surface text-ink")
              }
              style={
                isMe
                  ? {
                      background:
                        "linear-gradient(135deg, var(--brand-500), var(--brand-600))",
                    }
                  : undefined
              }
            >
              <p>{m.body}</p>
              <div
                className={
                  "mt-0.5 text-[10px] tabular-nums " +
                  (isMe ? "text-white/70" : "text-muted")
                }
              >
                {stamp}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
