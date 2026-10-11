"use client";

import { useRef, useState, useTransition } from "react";
import { sendMessage } from "@/app/_actions/dm";
import { buttonVariants } from "@/components/admin/ui/button";
import { cn } from "@/lib/utils";

export function MessageComposer({
  threadId,
  rolePrefix,
}: {
  threadId: string;
  rolePrefix: "parent" | "student" | "tutor" | "admin";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!pending) formRef.current?.requestSubmit();
    }
  }

  return (
    <form
      ref={formRef}
      // onSubmit rather than a form action: React resets a form as soon as its
      // action returns, which would wipe the draft when the send fails.
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const fd = new FormData(e.currentTarget);
        fd.append("threadId", threadId);
        fd.append("rolePrefix", rolePrefix);
        setError(null);
        startTransition(async () => {
          try {
            await sendMessage(fd);
            formRef.current?.reset();
          } catch {
            // Keep the draft so nothing typed is lost.
            setError("Message not sent. Please try again in a moment.");
          }
        });
      }}
      className="border-t border-line p-2.5"
    >
      <div className="flex items-end gap-2">
        <textarea
          name="body"
          required
          maxLength={4000}
          rows={1}
          placeholder="Write a message…"
          aria-label="Write a message"
          onKeyDown={handleKey}
          className="max-h-36 min-h-11 flex-1 resize-none rounded-[13px] border border-line-field bg-white px-3.5 py-[11px] text-[14px] leading-normal text-ink outline-none transition-colors [field-sizing:content] placeholder:text-muted focus-visible:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-400/40"
        />
        <button
          type="submit"
          disabled={pending}
          className={cn(
            buttonVariants({ variant: "primary" }),
            "h-11 rounded-[13px] px-[18px] text-[14px]",
          )}
        >
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 pl-1 text-[12px] font-semibold text-bad">
          {error}
        </p>
      ) : (
        <p className="mt-1.5 hidden pl-1 text-[11px] text-muted sm:block">
          Enter to send · Shift + Enter for a new line
        </p>
      )}
    </form>
  );
}
