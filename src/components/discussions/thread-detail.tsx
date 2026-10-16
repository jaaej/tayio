import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import type { ThreadDetail } from "@/lib/discussions-queries";
import { adminBoardLabel } from "@/lib/discussions";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SubjectDot } from "@/components/admin/ui/glass";
import { AttachmentList } from "./attachments";
import { ReplyList, RoleAvatar } from "./reply-list";
import { ReplyComposer } from "./reply-composer";
import { relativeShort, roleLabel, type DiscussionRole } from "./role-tone";

/**
 * Shared discussion thread view used identically by student, tutor and admin:
 * the question, then the replies with the reply composer last. A role page
 * may pass an `aside` panel for its side rail (admin moderation, the tutor's
 * "Asked by" card). The role pages only do auth + data fetch, then render this.
 */
export function DiscussionThreadDetail({
  thread,
  boardId,
  rolePrefix,
  aside,
}: {
  thread: ThreadDetail;
  boardId: string;
  rolePrefix: DiscussionRole;
  /** Optional role-specific panel shown beside the thread. */
  aside?: ReactNode;
}) {
  const threadBoardSegment =
    thread.subjectId === null ? "admin" : thread.subjectId;
  if (threadBoardSegment !== boardId) notFound();

  const boardLabel = thread.subjectName ?? adminBoardLabel();
  const removed = thread.deletedAt !== null;
  const title = removed ? "[removed by admin]" : thread.title;
  const liveReplies = thread.replies.filter((r) => !r.deletedAt);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back={{
          href: `/${rolePrefix}/discussions/${boardId}`,
          label: `Back to ${boardLabel}`,
        }}
        eyebrow={
          <>
            {thread.subjectName && (
              <SubjectDot subject={thread.subjectName} color={thread.subjectColor} />
            )}
            {boardLabel} · {thread.subjectName ? "Subject board" : "Open to all subjects"}
          </>
        }
        title={<span className="break-words">{title}</span>}
      />

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
          <section aria-label="Question" className="glass rounded-[24px] p-1.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 pb-2.5 pt-2">
              <RoleAvatar name={thread.authorName} role={thread.authorRole} size={32} />
              <span className="text-[14px] font-extrabold text-ink">{thread.authorName}</span>
              <span className="text-[12px] font-semibold text-ink-soft">
                {roleLabel(thread.authorRole)} · {relativeShort(thread.createdAt)}
              </span>
              <span className="ml-auto inline-flex h-[22px] items-center rounded-full bg-surface px-2.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-ink">
                Question
              </span>
            </div>
            <div className="panel p-[18px]">
              {removed ? (
                <p className="text-[14px] italic text-muted">[removed by admin]</p>
              ) : (
                <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.6] text-ink">
                  {thread.body}
                </p>
              )}
              {!removed && thread.attachments.length > 0 && (
                <AttachmentList attachments={thread.attachments} />
              )}
            </div>
          </section>

          <section
            aria-labelledby="replies-heading"
            className="glass rounded-[24px] p-1.5"
          >
            <div className="flex min-h-12 items-center gap-3 px-3 py-1.5">
              <h2 id="replies-heading" className="text-[16px] font-extrabold text-ink">
                Replies
              </h2>
              <span className="text-[13px] font-semibold tabular-nums text-ink-soft">
                {liveReplies.length}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <ReplyList
                replies={thread.replies}
                threadId={thread.id}
                rolePrefix={rolePrefix}
              />
              <ReplyComposer threadId={thread.id} rolePrefix={rolePrefix} />
            </div>
          </section>
        </div>

        {aside && (
          <div className="min-w-0 flex-[1_1_300px] lg:sticky lg:top-[var(--portal-sticky-top)] lg:max-w-[380px]">
            {aside}
          </div>
        )}
      </div>
    </div>
  );
}
