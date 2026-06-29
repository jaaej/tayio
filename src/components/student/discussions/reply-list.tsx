"use client";

import { useRef, useState, useTransition } from "react";
import { BadgeCheck, Send } from "lucide-react";
import type { AccentTokens } from "@/lib/subject-colors";
import type { ThreadDetail } from "@/lib/discussions-queries";
import { postReply } from "@/app/_actions/discussions";
import { initialOf, isStaffRole, relativeShort, roleColor } from "./role-tone";

type Reply = ThreadDetail["replies"][number];

export function StudentReplyList({
  replies,
  threadId,
  tokens,
}: {
  replies: Reply[];
  threadId: string;
  tokens: AccentTokens;
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
      <div className="py-2 text-[14px] text-muted">
        No replies yet — be the first to chime in.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {topLevel.map((r) => (
        <li key={r.id}>
          <ReplyRow
            reply={r}
            childReplies={childrenByParent.get(r.id) ?? []}
            threadId={threadId}
            tokens={tokens}
          />
        </li>
      ))}
    </ol>
  );
}

function ReplyRow({
  reply,
  childReplies,
  threadId,
  tokens,
}: {
  reply: Reply;
  childReplies: Reply[];
  threadId: string;
  tokens: AccentTokens;
}) {
  const [showComposer, setShowComposer] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const body = reply.deletedAt ? "[removed by admin]" : reply.body;
  const avatarColor = roleColor(reply.authorRole);
  const isStaff = isStaffRole(reply.authorRole) && !reply.deletedAt;

  return (
    <div
      className={
        isStaff
          ? "rounded-[18px] p-5"
          : "rounded-[16px] p-4 transition-colors hover:bg-surface-2"
      }
      style={
        isStaff
          ? {
              background: tokens.bgFrom,
              boxShadow: `inset 0 0 0 1.5px ${tokens.arrow}`,
            }
          : undefined
      }
    >
      {isStaff && (
        <div
          className="mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ background: tokens.pillBg, color: tokens.pillText }}
        >
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
          {reply.authorRole === "tutor" ? "Tutor answer" : "Staff answer"}
        </div>
      )}
      <div className="flex gap-4">
        <div
          className="h-[40px] w-[40px] rounded-full grid place-items-center text-[14px] font-bold text-white shrink-0"
          style={{ background: avatarColor }}
        >
          {initialOf(reply.authorName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-bold text-ink">
              {reply.authorName}
            </span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ background: tokens.pillBg, color: tokens.pillText }}
            >
              {reply.authorRole}
            </span>
            <span className="text-[11px] font-semibold text-muted tabular-nums">
              · {relativeShort(reply.createdAt)}
            </span>
          </div>
          <p className="mt-2 text-[15px] leading-[1.65] text-ink whitespace-pre-wrap">
            {body}
          </p>
          {!reply.deletedAt && (
            <button
              type="button"
              onClick={() => setShowComposer((v) => !v)}
              className="mt-3 text-[11px] uppercase tracking-[0.14em] font-bold transition-opacity hover:opacity-70"
              style={{ color: tokens.arrow }}
              aria-expanded={showComposer}
            >
              {showComposer ? "Cancel" : "Reply →"}
            </button>
          )}
        </div>
      </div>

      {childReplies.length > 0 && (
        <div
          className="mt-5 ml-[56px] pl-5 space-y-5 border-l-2"
          style={{ borderColor: tokens.ring }}
        >
          {childReplies.map((c) => (
            <NestedReply key={c.id} reply={c} tokens={tokens} />
          ))}
        </div>
      )}

      {showComposer && !reply.deletedAt && (
        <form
          ref={formRef}
          action={(fd) => {
            fd.append("threadId", threadId);
            fd.append("parentReplyId", reply.id);
            fd.append("rolePrefix", "student");
            startTransition(async () => {
              await postReply(fd);
              formRef.current?.reset();
              setShowComposer(false);
            });
          }}
          className="mt-4 ml-[56px] rounded-[16px] bg-surface-2 p-4 space-y-3"
        >
          <textarea
            name="body"
            required
            maxLength={4000}
            rows={3}
            placeholder={`Reply to ${reply.authorName}…`}
            autoFocus
            className="w-full rounded-[12px] border border-line bg-surface px-3 py-2.5 text-[14px] leading-relaxed placeholder:text-muted focus:outline-none focus:border-line-strong transition-colors"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50 transition-transform hover:-translate-y-[1px]"
              style={{ background: tokens.arrow }}
            >
              <Send className="h-3 w-3" aria-hidden />
              {pending ? "Posting…" : "Post reply"}
            </button>
            <button
              type="button"
              onClick={() => setShowComposer(false)}
              disabled={pending}
              className="text-[12px] font-semibold text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function NestedReply({
  reply,
  tokens,
}: {
  reply: Reply;
  tokens: AccentTokens;
}) {
  const body = reply.deletedAt ? "[removed by admin]" : reply.body;
  const avatarColor = roleColor(reply.authorRole);

  return (
    <div className="flex gap-3">
      <div
        className="h-[32px] w-[32px] rounded-full grid place-items-center text-[12px] font-bold text-white shrink-0"
        style={{ background: avatarColor }}
      >
        {initialOf(reply.authorName)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-bold text-ink">
            {reply.authorName}
          </span>
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.12em]"
            style={{ background: tokens.pillBg, color: tokens.pillText }}
          >
            {reply.authorRole}
          </span>
          <span className="text-[10px] font-semibold text-muted tabular-nums">
            · {relativeShort(reply.createdAt)}
          </span>
        </div>
        <p className="mt-1.5 text-[14px] leading-[1.6] text-ink whitespace-pre-wrap">
          {body}
        </p>
      </div>
    </div>
  );
}
