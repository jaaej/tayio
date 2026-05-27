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

const OTHER_LIMIT = 5;

export default async function StudentThreadPage({
  params,
}: {
  params: Promise<{ boardId: string; threadId: string }>;
}) {
  const { boardId, threadId } = await params;
  const user = await requireRole("student");
  const board = resolveBoardId(boardId);
  if (!board) notFound();
  if (!(await canSeeBoard(user.id, "student", board))) notFound();

  const thread = await getThreadWithReplies(threadId);
  if (!thread) notFound();

  const threadBoardSegment =
    thread.subjectId === null ? "admin" : thread.subjectId;
  if (threadBoardSegment !== boardId) notFound();

  const boardLabel = thread.subjectName ?? "Admin / Tech";

  const others = (await listThreadsForBoard(board))
    .filter((t) => t.id !== thread.id && !t.deletedAt)
    .slice(0, OTHER_LIMIT);

  return (
    <div className="space-y-6">
      <Link
        href={`/student/discussions/${boardId}`}
        className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-muted hover:text-ink font-medium"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        Back to {boardLabel}
      </Link>

      <div className="grid lg:grid-cols-2 gap-6 lg:items-start">
        {/* LEFT: question + composer (sticky on desktop) */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start min-w-0 lg:-ml-1.5">
          <QuestionBlock thread={thread} />
          <ReplyComposer threadId={thread.id} rolePrefix="student" />
        </div>

        {/* RIGHT: replies (scrolls with page) */}
        <Card className="min-w-0 lg:-mr-1.5">
          <RepliesList
            replies={thread.replies}
            threadId={thread.id}
            rolePrefix="student"
          />
        </Card>
      </div>

      {others.length > 0 && (
        <Card>
          <OtherQuestions
            threads={others}
            hrefPrefix={`/student/discussions/${boardId}`}
            boardLabel={boardLabel}
          />
        </Card>
      )}
    </div>
  );
}
