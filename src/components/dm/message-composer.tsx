"use client";

import { useRef, useTransition } from "react";
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
      className="flex items-end gap-2 px-5 py-3 border-t border-hairline/60 bg-card"
    >
      <textarea
        name="body"
        required
        maxLength={4000}
        rows={2}
        placeholder="Write a message…"
        onKeyDown={handleKey}
        className="flex-1 resize-none bg-transparent border-0 outline-none text-base placeholder:text-muted"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
