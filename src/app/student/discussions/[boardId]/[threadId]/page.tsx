import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  canSeeBoard,
  getThreadWithReplies,
} from "@/lib/discussions-queries";
import { resolveBoardId } from "@/lib/discussions";
import { DiscussionThreadDetail } from "@/components/discussions/thread-detail";

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

  const userFirstName =
    (user.user_metadata?.first_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "you";

  return (
    <DiscussionThreadDetail
      thread={thread}
      boardId={boardId}
      rolePrefix="student"
      userFirstName={userFirstName}
    />
  );
}
