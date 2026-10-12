import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  canSeeBoard,
  getThreadWithReplies,
} from "@/lib/discussions-queries";
import { resolveBoardId, threadIsOnBoard } from "@/lib/discussions";
import { AskedByCard } from "@/components/discussions/asked-by-card";
import { DiscussionThreadDetail } from "@/components/discussions/thread-detail";
import { getThreadAskerForTutor } from "../../_lib/asker";

export default async function TutorThreadPage({
  params,
}: {
  params: Promise<{ boardId: string; threadId: string }>;
}) {
  const { boardId, threadId } = await params;
  const user = await requireRole("tutor");
  const board = resolveBoardId(boardId);
  if (!board) notFound();
  if (!(await canSeeBoard(user.id, "tutor", board))) notFound();

  const thread = await getThreadWithReplies(threadId);
  if (!thread || !threadIsOnBoard(thread.subjectId, board)) notFound();

  const asker = await getThreadAskerForTutor(user.id, thread);

  return (
    <DiscussionThreadDetail
      thread={thread}
      boardId={boardId}
      rolePrefix="tutor"
      aside={
        asker && (
          <AskedByCard
            person={asker}
            note="Your replies show a “Tutor answer” tag so students know they can rely on them."
          />
        )
      }
    />
  );
}
