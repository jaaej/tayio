import type { MessageRow } from "@/lib/dm-queries";

export function MessageList({
  messages,
  meId,
}: {
  messages: MessageRow[];
  meId: string;
}) {
  if (messages.length === 0) {
    return (
      <div className="text-sm text-ink-soft py-8 text-center">
        No messages yet. Say hi.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {messages.map((m) => {
        const isMe = m.senderId === meId;
        const stamp = m.createdAt.toLocaleTimeString("en-AU", {
          hour: "numeric",
          minute: "2-digit",
        });
        return (
          <div
            key={m.id}
            className={`flex ${isMe ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                isMe
                  ? "bg-brand-100 text-ink"
                  : "bg-white border border-hairline/60 text-ink"
              }`}
            >
              <p className="text-base whitespace-pre-wrap leading-relaxed">
                {m.body}
              </p>
              <div
                className={`mt-1 text-[10px] uppercase tracking-[0.14em] tabular-nums ${
                  isMe ? "text-brand-700/70" : "text-muted"
                }`}
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
