"use client";

import { useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import type { UserRole } from "@/db/schema";
import type { ThreadDetail } from "@/lib/discussions-queries";
import { postReply } from "@/app/_actions/discussions";
import { Button } from "@/components/admin/ui/button";
import { initialsOf } from "@/components/admin/ui/glass";
import { ActionButtonLabel } from "@/components/ui/loading-button";
import { cn } from "@/lib/utils";
import { AttachmentList, AttachmentPicker } from "./attachments";
import {
  isStaffRole,
  relativeShort,
  replyRoleLabel,
  roleTone,
  type DiscussionRole,
} from "./role-tone";

type Reply = ThreadDetail["replies"][number];

/** Initials avatar tinted by the author's role. */
export function RoleAvatar({
  name,
  role,
  size = 32,
}: {
  name: string;
  role: UserRole;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-extrabold",
        roleTone(role),
      )}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.375)) }}
    >
      {initialsOf(name)}
    </span>
  );
}

/**
 * The tag beside a staff author's name ("Tutor answer", "Admin"); students
 * go untagged.
 */
function RolePill({ role }: { role: UserRole }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-extrabold",
        roleTone(role),
      )}
    >
      {replyRoleLabel(role)}
    </span>
  );
}

export function ReplyList({
  replies,
  threadId,
  rolePrefix,
}: {
  replies: Reply[];
  threadId: string;
  rolePrefix: DiscussionRole;
}) {
  const topLevel = replies.filter((r) => r.parentReplyId === null);
  const childrenByParent = new Map<string, Reply[]>();
  for (const r of replies) {
    if (r.parentReplyId) {
      const list = childrenByParent.get(r.parentReplyId) ?? [];
      list.push(r);
      childrenByParent.set(r.parentReplyId, list);
    }
  }

  if (topLevel.length === 0) {
    return (
      <p className="border-b border-line px-4 py-5 text-[14px] text-muted">
        No replies yet - be the first to chime in.
      </p>
    );
  }

  return (
    <ol className="divide-y divide-line border-b border-line">
      {topLevel.map((r) => {
        const answer = isStaffRole(r.authorRole) && !r.deletedAt;
        return (
          <li
            key={r.id}
            className={cn("px-4 py-3.5", answer && "border-l-[3px] border-l-good bg-[#F2FAF6] pl-[13px]")}
          >
            <ReplyRow
              reply={r}
              childReplies={childrenByParent.get(r.id) ?? []}
              threadId={threadId}
              rolePrefix={rolePrefix}
            />
          </li>
        );
      })}
    </ol>
  );
}

function ReplyBody({ reply, size }: { reply: Reply; size: "md" | "sm" }) {
  const removed = reply.deletedAt !== null;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="flex flex-wrap items-center gap-2">
        <span className={cn("font-extrabold text-ink", size === "md" ? "text-[14px]" : "text-[13px]")}>
          {reply.authorName}
        </span>
        {!removed && isStaffRole(reply.authorRole) && <RolePill role={reply.authorRole} />}
        <span className="ml-auto text-[12px] tabular-nums text-muted">
          {relativeShort(reply.createdAt)}
        </span>
      </span>
      {removed ? (
        <p className="text-[13px] italic text-muted">[removed by admin]</p>
      ) : (
        <p
          className={cn(
            "whitespace-pre-wrap break-words text-ink",
            size === "md" ? "text-[14px] leading-[1.6]" : "text-[13px] leading-[1.5]",
          )}
        >
          {reply.body}
        </p>
      )}
      {!removed && reply.attachments.length > 0 && (
        <AttachmentList attachments={reply.attachments} />
      )}
    </div>
  );
}

function ReplyRow({
  reply,
  childReplies,
  threadId,
  rolePrefix,
}: {
  reply: Reply;
  childReplies: Reply[];
  threadId: string;
  rolePrefix: DiscussionRole;
}) {
  const [showComposer, setShowComposer] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-1">
          <ReplyBody reply={reply} size="md" />
          {!reply.deletedAt && (
            <button
              type="button"
              onClick={() => setShowComposer((v) => !v)}
              className="-ml-1.5 self-start rounded-[8px] px-1.5 py-1 text-[12px] font-bold text-brand-600 transition-colors hover:bg-surface-2 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              aria-expanded={showComposer}
            >
              {showComposer ? "Cancel" : "Reply"}
            </button>
          )}
      </div>

      {childReplies.length > 0 && (
        <ol className="ml-1 flex flex-col gap-3 border-l-2 border-line pl-4">
          {childReplies.map((c) => (
            <li key={c.id} className="flex">
              <ReplyBody reply={c} size="sm" />
            </li>
          ))}
        </ol>
      )}

      {showComposer && !reply.deletedAt && (
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
          className="flex flex-col gap-2.5 rounded-[12px] bg-surface-2 p-3"
        >
          <textarea
            name="body"
            required
            maxLength={4000}
            rows={3}
            placeholder={`Reply to ${reply.authorName}…`}
            aria-label={`Reply to ${reply.authorName}`}
            autoFocus
            className="w-full resize-y rounded-[10px] border border-line-field bg-surface px-3 py-2.5 text-[14px] leading-relaxed text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <AttachmentPicker accent="var(--ink)" />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowComposer(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                <ActionButtonLabel pending={pending} pendingLabel="Posting…">
                  <>
                    <Send className="h-3 w-3" aria-hidden />
                    Post reply
                  </>
                </ActionButtonLabel>
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
