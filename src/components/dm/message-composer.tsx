"use client";

import { useRef, useTransition } from "react";
import { Send } from "lucide-react";
import { sendMessage } from "@/app/_actions/dm";

export function MessageComposer({
  threadId,
  rolePrefix,
}: {
  threadId: string;
  rolePrefix: "parent" | "student" | "tutor" | "admin";
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <form
      ref={formRef}
      action={(fd) => {
        fd.append("threadId", threadId);
        fd.append("rolePrefix", rolePrefix);
        startTransition(async () => {
          await sendMessage(fd);
          formRef.current?.reset();
        });
      }}
      className="border-t border-line bg-surface px-4 py-3"
    >
      <div className="flex items-end gap-2 rounded-[18px] border border-line bg-surface-2 px-3 py-2 transition-colors focus-within:border-line-strong focus-within:bg-surface">
        <textarea
          name="body"
          required
          maxLength={4000}
          rows={1}
          placeholder="Write a message…"
          onKeyDown={handleKey}
          className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent border-0 outline-none text-[15px] leading-relaxed text-ink placeholder:text-muted py-1"
        />
        <button
          type="submit"
          disabled={pending}
          aria-label="Send message"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white shadow-[0_6px_16px_-8px_rgba(31,40,90,0.6)] transition-transform disabled:opacity-50 motion-safe:hover:-translate-y-[1px] motion-safe:active:scale-95"
          style={{
            background: "linear-gradient(135deg, var(--brand-500), var(--brand-600))",
          }}
        >
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="mt-1.5 pl-1 text-[10px] text-muted-2">
        Enter to send · Shift + Enter for a new line
      </div>
    </form>
  );
}
