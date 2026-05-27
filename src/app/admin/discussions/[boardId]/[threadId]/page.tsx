import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import {
  canSeeBoard,
  getThreadWithReplies,
  listThreadsForBoard,
} from "@/lib/discussions-queries";
import { resolveBoardId } from "@/lib/discussions";
import {
  QuestionBlock,
  RepliesList,
} from "@/components/discussions/thread-view";
import { ReplyComposer } from "@/components/discussions/reply-composer";
import { OtherQuestions } from "@/components/discussions/other-questions";
import { softDelete } from "@/app/_actions/discussions";

const OTHER_LIMIT = 5;

export default async function AdminThreadPage({
  params,
}: {
  params: Promise<{ boardId: string; threadId: string }>;
}) {
  const { boardId, threadId } = await params;
  const user = await requireRole("admin");
  const board = resolveBoardId(boardId);
  if (!board) notFound();
  if (!(await canSeeBoard(user.id, "admin", board))) notFound();

  const thread = await getThreadWithReplies(threadId);
  if (!thread) notFound();

  const threadBoardSegment =
    thread.subjectId === null ? "admin" : thread.subjectId;
  if (threadBoardSegment !== boardId) notFound();

  const boardLabel = thread.subjectName ?? "Admin / Tech";

  const others = (await listThreadsForBoard(board))
    .filter((t) => t.id !== thread.id && !t.deletedAt)
    .slice(0, OTHER_LIMIT);

  const liveReplies = thread.replies.filter((r) => !r.deletedAt);

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/discussions/${boardId}`}
        className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-muted hover:text-ink font-medium"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        Back to {boardLabel}
      </Link>

      <div className="grid lg:grid-cols-2 gap-6 lg:items-start">
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start min-w-0 lg:-ml-1.5">
          <QuestionBlock thread={thread} />
          <ReplyComposer threadId={thread.id} rolePrefix="admin" />

          <Card>
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-medium mb-3">
              Admin controls
            </div>
            <div className="flex flex-wrap gap-2">
              {!thread.deletedAt && (
                <form action={softDelete}>
                  <input type="hidden" name="kind" value="thread" />
                  <input type="hidden" name="id" value={thread.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                  >
                    Remove thread
                  </button>
                </form>
              )}
              {liveReplies.map((r) => (
                <form action={softDelete} key={r.id}>
                  <input type="hidden" name="kind" value="reply" />
                  <input type="hidden" name="id" value={r.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                  >
                    Remove reply by {r.authorName}
                  </button>
                </form>
              ))}
              {!thread.deletedAt && liveReplies.length === 0 && (
                <span className="text-xs text-ink-soft italic">
                  No replies to manage.
                </span>
              )}
            </div>
          </Card>
        </div>

        <Card className="min-w-0 lg:-mr-3">
          <RepliesList
            replies={thread.replies}
            threadId={thread.id}
            rolePrefix="admin"
          />
        </Card>
      </div>

      {others.length > 0 && (
        <Card>
          <OtherQuestions
            threads={others}
            hrefPrefix={`/admin/discussions/${boardId}`}
            boardLabel={boardLabel}
          />
        </Card>
      )}
    </div>
  );
}
