"use client";

import { useRef, useTransition } from "react";
import { Send } from "lucide-react";
import { postReply } from "@/app/_actions/discussions";
import { Button } from "@/components/admin/ui/button";
import { ActionButtonLabel } from "@/components/ui/loading-button";
import { AttachmentPicker } from "./attachments";
import type { DiscussionRole } from "./role-tone";

/** Always-open reply box at the end of a thread's replies. */
export function ReplyComposer({
  threadId,
  rolePrefix,
}: {
  threadId: string;
  rolePrefix: DiscussionRole;
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(fd) => {
        fd.append("threadId", threadId);
        fd.append("rolePrefix", rolePrefix);
        startTransition(async () => {
          await postReply(fd);
          formRef.current?.reset();
        });
      }}
      className="panel flex flex-col gap-2.5 p-3.5"
    >
      <textarea
        name="body"
        required
        maxLength={4000}
        rows={3}
        aria-label="Write a reply"
        placeholder={
          rolePrefix === "tutor"
            ? "Write your answer - it'll be tagged Tutor answer."
            : "Share what you know - or where you got stuck too."
        }
        className="w-full resize-y rounded-[12px] border border-line-field bg-surface p-3 text-[14px] leading-relaxed text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AttachmentPicker accent="var(--ink)" />
        <Button type="submit" disabled={pending} className="h-10 rounded-[11px] px-[18px] text-[14px]">
          <ActionButtonLabel pending={pending} pendingLabel="Posting…">
            <>
              <Send className="h-3.5 w-3.5" aria-hidden />
              Post reply
            </>
          </ActionButtonLabel>
        </Button>
      </div>
    </form>
  );
}
