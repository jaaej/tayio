"use client";

import { useRef, useTransition } from "react";
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
  // A tutor's reply is tagged "Tutor answer", so it is an answer they post.
  const noun = rolePrefix === "tutor" ? "answer" : "reply";

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
      className="flex flex-wrap items-end gap-2 p-3 sm:flex-nowrap sm:p-3.5"
    >
      <AttachmentPicker iconOnly />
      <textarea
        name="body"
        required
        maxLength={4000}
        rows={2}
        aria-label={`Write your ${noun}`}
        placeholder={`Write your ${noun}`}
        className="min-h-[56px] min-w-0 flex-1 basis-[220px] resize-y rounded-[12px] border border-line-field bg-surface px-3 py-2.5 text-[14px] leading-relaxed text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10"
      />
      <Button type="submit" disabled={pending} className="h-11 shrink-0 rounded-[11px] px-[18px] text-[14px] max-sm:ml-auto">
        <ActionButtonLabel pending={pending} pendingLabel="Posting…">
          {`Post ${noun}`}
        </ActionButtonLabel>
      </Button>
    </form>
  );
}
