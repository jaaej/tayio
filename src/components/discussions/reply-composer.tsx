"use client";

import { useRef, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { postReply } from "@/app/_actions/discussions";
import { AttachmentPicker } from "@/components/discussions/attachments";

export function ReplyComposer({
  threadId,
  rolePrefix,
}: {
  threadId: string;
  rolePrefix: "student" | "tutor" | "admin";
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Card>
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
        className="space-y-3"
      >
        <textarea
          name="body"
          required
          maxLength={4000}
          rows={4}
          placeholder="Write a reply…"
          className="w-full rounded-lg border border-hairline/60 bg-card px-3 py-2.5 text-base focus:outline-none focus:border-brand-600"
        />
        <AttachmentPicker />
        <div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Posting…" : "Reply"}
          </button>
        </div>
      </form>
    </Card>
  );
}
