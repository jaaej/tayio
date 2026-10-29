import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { ThreadDetail, ThreadSummary } from "@/lib/discussions-queries";
import { adminBoardLabel } from "@/lib/discussions";
import { buttonVariants } from "@/components/admin/ui/button";
import { SubjectDot } from "@/components/admin/ui/glass";
import { cn } from "@/lib/utils";
import { AttachmentList } from "./attachments";
import { OtherQuestions } from "./other-questions";
import { ReplyList } from "./reply-list";
import { ReplyComposer } from "./reply-composer";
import { relativeShort, roleLabel, type DiscussionRole } from "./role-tone";

/**
 * Shared discussion thread view used identically by student, tutor and admin:
 * the question, its replies with the reply box last, and the board's other
 * questions beside it. A role page may pass an `aside` panel for under that
 * list (admin moderation, the tutor's "Asked by" card, the student's next
 * steps). The role pages only do auth + data fetch, then render this.
 */
export function DiscussionThreadDetail({
  thread,
  boardId,
  rolePrefix,
  others,
  aside,
}: {
  thread: ThreadDetail;
  boardId: string;
  rolePrefix: DiscussionRole;
  /** Every thread on this board (`listThreadsForBoard`), this one included. */
  others: ThreadSummary[];
  /** Optional role-specific panel shown under the board's other questions. */
  aside?: ReactNode;
}) {
  const threadBoardSegment =
    thread.subjectId === null ? "admin" : thread.subjectId;
  if (threadBoardSegment !== boardId) notFound();

  const boardLabel = thread.subjectName ?? adminBoardLabel();
  const removed = thread.deletedAt !== null;
  const title = removed ? "[removed by admin]" : thread.title;
  const liveReplies = thread.replies.filter((r) => !r.deletedAt);
  const boardHref = `/${rolePrefix}/discussions/${boardId}`;

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="glass flex min-w-0 flex-[999_1_520px] flex-col rounded-[24px] p-1.5">
        <section aria-labelledby="thread-title" className="panel flex flex-col gap-3 p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <Link
              href={boardHref}
              aria-label={`Back to ${boardLabel}`}
              title={`Back to ${boardLabel}`}
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "-ml-2 h-9 w-9 shrink-0 rounded-[10px]")}
            >
              <ChevronLeft className="h-[17px] w-[17px]" strokeWidth={2.4} aria-hidden />
            </Link>
            <span className="flex min-w-0 items-center gap-2 text-[13px] font-bold text-ink-soft">
              {thread.subjectName && (
                <SubjectDot subject={thread.subjectName} color={thread.subjectColor} />
              )}
              <span className="truncate">{boardLabel}</span>
            </span>
            {!removed && (
              <span
                className={cn(
                  "ml-auto inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-extrabold",
                  liveReplies.length > 0 ? "bg-good-bg text-good" : "bg-warn-bg text-warn",
                )}
              >
                {liveReplies.length > 0 ? "Answered" : "Unanswered"}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <h1
              id="thread-title"
              className={cn(
                "break-words text-[24px] font-extrabold leading-tight tracking-[-0.01em]",
                removed ? "italic text-muted" : "text-ink",
              )}
            >
              {title}
            </h1>
            <p className="text-[13px] font-semibold text-ink-soft">
              {thread.authorName} · {roleLabel(thread.authorRole)} · {relativeShort(thread.createdAt)}
            </p>
          </div>
          {!removed && (
            <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.7] text-ink">
              {thread.body}
            </p>
          )}
          {!removed && thread.attachments.length > 0 && (
            <AttachmentList attachments={thread.attachments} />
          )}
        </section>

        <section aria-labelledby="replies-heading" className="flex flex-col">
          <h2 id="replies-heading" className="px-3 pb-2.5 pt-4 text-[16px] font-extrabold text-ink">
            Replies{" "}
            <span className="text-[13px] font-semibold tabular-nums text-ink-soft">
              {liveReplies.length}
            </span>
          </h2>
          <div className="panel overflow-hidden">
            <ReplyList
              replies={thread.replies}
              threadId={thread.id}
              rolePrefix={rolePrefix}
            />
            <ReplyComposer threadId={thread.id} rolePrefix={rolePrefix} />
          </div>
        </section>
      </div>

      <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-5 lg:sticky lg:top-[var(--portal-sticky-top)] lg:max-w-[380px]">
        <OtherQuestions
          threads={others
            .filter((t) => !t.deletedAt || t.id === thread.id)
            .map((t) => ({
              id: t.id,
              title: t.deletedAt ? "[removed by admin]" : t.title,
              authorName: t.authorName,
              when: relativeShort(t.lastActivityAt),
              replyCount: t.replyCount,
              removed: t.deletedAt !== null,
            }))}
          currentId={thread.id}
          boardHref={boardHref}
        />
        {aside}
      </div>
    </div>
  );
}
