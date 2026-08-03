"use client";

import { useRef, useState, useTransition } from "react";
import { postReply } from "@/app/_actions/discussions";
import type { DiscussionAttachmentView } from "@/lib/discussions-queries";
import {
  AttachmentList,
  AttachmentPicker,
} from "@/components/discussions/attachments";

type Reply = {
  id: string;
  parentReplyId: string | null;
  body: string;
  authorName: string;
  authorRole: string;
  createdAt: Date;
  deletedAt: Date | null;
  attachments: DiscussionAttachmentView[];
};

export function ReplyItem({
  reply,
  childReplies = [],
  threadId,
  rolePrefix,
}: {
  reply: Reply;
  childReplies?: Reply[];
  threadId: string;
  rolePrefix: "student" | "tutor" | "admin";
}) {
  const [showComposer, setShowComposer] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const stamp = reply.createdAt.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
  const body = reply.deletedAt ? "[removed by admin]" : reply.body;
  const isChild = reply.parentReplyId !== null;

  return (
    <div className="rounded-xl bg-white border border-hairline/60 transition-all duration-200 hover:border-hairline hover:shadow-[0_8px_24px_-18px_rgba(29,41,81,0.25)]">
      <div className="px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] bg-[rgba(29,41,81,0.05)] text-ink-soft border border-hairline/60">
            {reply.authorRole}
          </span>
          <span className="text-sm font-medium text-ink">
            {reply.authorName}
          </span>
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted ml-auto tabular-nums">
            {stamp}
          </span>
        </div>
        <p className="mt-3 text-base text-ink whitespace-pre-wrap leading-relaxed">
          {body}
        </p>
        {reply.attachments.length > 0 && (
          <AttachmentList attachments={reply.attachments} />
        )}
        {!reply.deletedAt && !isChild && (
          <div className="mt-3 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setShowComposer((v) => !v)}
              className="text-xs font-medium text-brand-700 hover:text-brand-800 uppercase tracking-[0.14em]"
              aria-expanded={showComposer}
            >
              {showComposer ? "Cancel" : "Reply"}
            </button>
          </div>
        )}
      </div>

      {/* Nested children: replies to this reply, indented and separated by hairline */}
      {childReplies.length > 0 && (
        <div className="border-t border-hairline/60 bg-[rgba(29,41,81,0.025)] px-4 py-3 space-y-2 rounded-b-xl">
          {childReplies.map((child) => (
            <NestedChildReply key={child.id} reply={child} />
          ))}
        </div>
      )}

      {/* Inline composer (only on top-level replies) */}
      {showComposer && !isChild && (
        <form
          ref={formRef}
          action={(fd) => {
            fd.append("threadId", threadId);
            fd.append("parentReplyId", reply.id);
            fd.append("rolePrefix", rolePrefix);
            startTransition(async () => {
              await postReply(fd);
              formRef.current?.reset();
              setShowComposer(false);
            });
          }}
          className="border-t border-hairline/60 bg-brand-50/30 px-4 py-3 space-y-2 rounded-b-xl"
        >
          <textarea
            name="body"
            required
            maxLength={4000}
            rows={3}
            placeholder={`Reply to ${reply.authorName}…`}
            className="w-full rounded-lg border border-hairline/60 bg-white px-3 py-2 text-base focus:outline-none focus:border-brand-600"
            autoFocus
          />
          <AttachmentPicker />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending ? "Posting…" : "Post reply"}
            </button>
            <button
              type="button"
              onClick={() => setShowComposer(false)}
              disabled={pending}
              className="text-sm text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function NestedChildReply({ reply }: { reply: Reply }) {
  const stamp = reply.createdAt.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
  const body = reply.deletedAt ? "[removed by admin]" : reply.body;

  return (
    <div className="relative pl-4">
      {/* Indent rail */}
      <span
        aria-hidden
        className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-hairline"
      />
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] bg-white text-ink-soft border border-hairline/60">
          {reply.authorRole}
        </span>
        <span className="text-sm font-medium text-ink">
          {reply.authorName}
        </span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted ml-auto tabular-nums">
          {stamp}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-ink whitespace-pre-wrap leading-relaxed">
        {body}
      </p>
      {reply.attachments.length > 0 && (
        <AttachmentList attachments={reply.attachments} />
      )}
    </div>
  );
}
