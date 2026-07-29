"use client";

import { useRef, useState, useTransition } from "react";
import { Send, X } from "lucide-react";
import type { AccentTokens } from "@/lib/subject-colors";
import { postReply } from "@/app/_actions/discussions";
import { AttachmentPicker } from "@/components/discussions/attachments";
import { initialOf } from "./role-tone";

export function StudentReplyComposer({
  threadId,
  tokens,
  userFirstName,
}: {
  threadId: string;
  tokens: AccentTokens;
  userFirstName: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group w-full flex items-center gap-4 rounded-[20px] bg-surface border border-line px-5 py-4 text-left transition-all duration-150 hover:border-line-strong hover:shadow-[0_18px_38px_-22px_rgba(31,40,90,0.25)] motion-safe:hover:-translate-y-[2px]"
      >
        <div
          className="h-[40px] w-[40px] rounded-full grid place-items-center text-[14px] font-bold text-white shrink-0"
          style={{ background: tokens.arrow }}
        >
          {initialOf(userFirstName)}
        </div>
        <span className="flex-1 text-[14px] text-muted font-semibold">
          Add your reply…
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-bold text-white shadow-[0_8px_20px_-10px_rgba(31,40,90,0.5)] shrink-0"
          style={{
            background: `linear-gradient(135deg, ${tokens.arrow}, ${tokens.title})`,
          }}
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          Reply
        </span>
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={(fd) => {
        fd.append("threadId", threadId);
        fd.append("rolePrefix", "student");
        startTransition(async () => {
          await postReply(fd);
          formRef.current?.reset();
          setOpen(false);
        });
      }}
      className="rounded-[20px] bg-surface border border-line p-6 space-y-4 shadow-[0_18px_38px_-22px_rgba(31,40,90,0.20)]"
    >
      <div className="flex items-center gap-3">
        <div
          className="h-[40px] w-[40px] rounded-full grid place-items-center text-[14px] font-bold text-white shrink-0"
          style={{ background: tokens.arrow }}
        >
          {initialOf(userFirstName)}
        </div>
        <div
          className="flex-1 text-[10px] uppercase tracking-[0.18em] font-bold"
          style={{ color: tokens.arrow }}
        >
          Your reply
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted hover:text-ink transition-colors"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <textarea
        name="body"
        required
        maxLength={4000}
        rows={4}
        autoFocus
        placeholder="Share what you know - or where you got stuck too."
        className="w-full rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-[15px] leading-relaxed placeholder:text-muted focus:outline-none focus:bg-surface focus:border-line-strong transition-colors"
      />
      <AttachmentPicker accent={tokens.arrow} />
      <div className="flex items-center gap-3 pt-2 border-t border-line">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_20px_-10px_rgba(31,40,90,0.5)] disabled:opacity-50 transition-transform motion-safe:hover:-translate-y-[1px] motion-safe:active:scale-[0.98]"
          style={{
            background: `linear-gradient(135deg, ${tokens.arrow}, ${tokens.title})`,
          }}
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          {pending ? "Posting…" : "Post reply"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="text-[13px] font-semibold text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
