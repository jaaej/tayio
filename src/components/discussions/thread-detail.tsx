import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, HelpCircle, MessageSquareText } from "lucide-react";
import type { ThreadDetail } from "@/lib/discussions-queries";
import {
  colorFamilyForSubject,
  getAccentTokens,
} from "@/lib/subject-colors";
import { AttachmentList } from "@/components/discussions/attachments";
import { ReplyList } from "./reply-list";
import { ReplyComposer } from "./reply-composer";
import { ThreadBackdrop } from "./thread-backdrop";
import { GENERIC_TOKENS } from "./board-detail";
import { initialOf, roleColor, type DiscussionRole } from "./role-tone";

/**
 * Shared discussion thread-detail view used identically by student, tutor and
 * admin: a two-column layout with a sticky subject-accented question card +
 * reply composer on the left and the threaded reply list on the right, over a
 * decorative subject-colour backdrop. The three role pages only do auth + data
 * fetch, then render this.
 */
export function DiscussionThreadDetail({
  thread,
  boardId,
  rolePrefix,
  userFirstName,
  moderation,
}: {
  thread: ThreadDetail;
  boardId: string;
  rolePrefix: DiscussionRole;
  userFirstName: string;
  /** Optional role-specific panel (e.g. admin moderation) shown under the composer. */
  moderation?: ReactNode;
}) {
  const threadBoardSegment =
    thread.subjectId === null ? "admin" : thread.subjectId;
  if (threadBoardSegment !== boardId) notFound();

  const boardLabel = thread.subjectName ?? "General help";
  const tokens = thread.subjectName
    ? getAccentTokens(colorFamilyForSubject(thread.subjectName))
    : GENERIC_TOKENS;

  const title = thread.deletedAt ? "[removed by admin]" : thread.title;
  const body = thread.deletedAt ? "" : thread.body;
  const stamp = thread.createdAt.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const liveReplies = thread.replies.filter((r) => !r.deletedAt);

  // Distinct people in the thread (question author first), for the activity stack.
  const participants: { name: string; role: string }[] = [];
  const seenAuthors = new Set<string>();
  for (const p of [
    { name: thread.authorName, role: thread.authorRole },
    ...liveReplies.map((r) => ({ name: r.authorName, role: r.authorRole })),
  ]) {
    if (seenAuthors.has(p.name)) continue;
    seenAuthors.add(p.name);
    participants.push(p);
  }

  return (
    <div className="relative min-h-full">
      <ThreadBackdrop tokens={tokens} />
      <div className="relative z-10 space-y-6">
        <Link
          href={`/${rolePrefix}/discussions/${boardId}`}
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] font-bold text-muted hover:text-ink transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Back to {boardLabel}
        </Link>

        <div className="grid lg:grid-cols-2 gap-6 items-start">
          {/* LEFT: question + composer (sticky on desktop) */}
          <div className="space-y-5 min-w-0 lg:sticky lg:top-6 lg:self-start">
            <article
              className="relative overflow-hidden rounded-[24px] border border-line"
              style={{
                borderTopColor: tokens.arrow,
                borderTopWidth: "4px",
                borderTopStyle: "solid",
                background: `linear-gradient(160deg, ${tokens.bgFrom} 0%, var(--surface) 58%)`,
              }}
            >
              <div
                aria-hidden
                className="absolute -right-12 -top-14 w-[220px] h-[220px] rounded-full opacity-[0.10] pointer-events-none"
                style={{
                  background: `radial-gradient(circle, ${tokens.arrow}, transparent 70%)`,
                }}
              />
              <div className="relative px-8 py-8">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.16em]"
                    style={{ background: tokens.pillBg, color: tokens.pillText }}
                  >
                    <HelpCircle className="h-3.5 w-3.5" aria-hidden />
                    Question
                  </span>
                  <span
                    className="text-[11px] uppercase tracking-[0.16em] font-bold"
                    style={{ color: tokens.arrow, opacity: 0.85 }}
                  >
                    {boardLabel}
                  </span>
                  <span className="text-[10px] font-bold text-muted uppercase tracking-[0.14em] tabular-nums ml-auto">
                    {stamp}
                  </span>
                </div>

                <h1
                  className="mt-5 text-[28px] lg:text-[32px] font-bold leading-[1.1] tracking-[-0.02em]"
                  style={{ color: tokens.title }}
                >
                  {title}
                </h1>

                {body && (
                  <p className="mt-5 text-[15px] whitespace-pre-wrap leading-[1.7] text-ink">
                    {body}
                  </p>
                )}

                {thread.attachments.length > 0 && (
                  <AttachmentList
                    attachments={thread.attachments}
                    accent={tokens.arrow}
                  />
                )}

                <div className="mt-7 pt-5 border-t border-line flex items-center gap-3">
                  <div
                    className="h-[44px] w-[44px] rounded-full grid place-items-center text-[15px] font-bold text-white shrink-0 ring-2 ring-white shadow-[0_4px_12px_-4px_rgba(31,40,90,0.4)]"
                    style={{ background: roleColor(thread.authorRole) }}
                  >
                    {initialOf(thread.authorName)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-ink truncate">
                      {thread.authorName}
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.14em] font-bold text-muted">
                      {thread.authorRole} · asked the question
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <ReplyComposer
              threadId={thread.id}
              tokens={tokens}
              userFirstName={userFirstName}
              rolePrefix={rolePrefix}
            />

            {moderation}
          </div>

          {/* RIGHT: replies */}
          <div className="min-w-0">
            <section className="bg-surface border border-line rounded-[24px] px-7 py-6">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2.5">
                  <div
                    className="grid place-items-center h-8 w-8 rounded-[10px]"
                    style={{ background: tokens.pillBg, color: tokens.arrow }}
                  >
                    <MessageSquareText className="h-[18px] w-[18px]" aria-hidden />
                  </div>
                  <h2 className="text-[18px] font-bold text-ink tracking-[-0.01em]">
                    {liveReplies.length}{" "}
                    {liveReplies.length === 1 ? "reply" : "replies"}
                  </h2>
                </div>
                {participants.length > 1 && (
                  <div className="flex items-center gap-2.5">
                    <div className="flex -space-x-2.5">
                      {participants.slice(0, 5).map((p) => (
                        <div
                          key={p.name}
                          title={p.name}
                          className="h-8 w-8 rounded-full grid place-items-center text-[12px] font-bold text-white ring-2 ring-surface"
                          style={{ background: roleColor(p.role) }}
                        >
                          {initialOf(p.name)}
                        </div>
                      ))}
                      {participants.length > 5 && (
                        <div className="h-8 w-8 rounded-full grid place-items-center text-[11px] font-bold text-muted bg-surface-2 ring-2 ring-surface">
                          +{participants.length - 5}
                        </div>
                      )}
                    </div>
                    <span className="hidden sm:inline text-[11px] uppercase tracking-[0.14em] font-bold text-muted">
                      in this thread
                    </span>
                  </div>
                )}
              </div>
              <ReplyList
                replies={thread.replies}
                threadId={thread.id}
                tokens={tokens}
                rolePrefix={rolePrefix}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
