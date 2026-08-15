import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  canSeeBoard,
  listThreadsForBoard,
} from "@/lib/discussions-queries";
import { resolveBoardId } from "@/lib/discussions";
import { DiscussionBoardDetail } from "@/components/discussions/board-detail";

export default async function AdminBoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const user = await requireRole("admin");
  const board = resolveBoardId(boardId);
  if (!board) notFound();
  if (!(await canSeeBoard(user.id, "admin", board))) notFound();

  const threads = await listThreadsForBoard(board);
  const userFirstName =
    (user.user_metadata?.first_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "you";

  return (
    <DiscussionBoardDetail
      board={board}
      boardSegment={boardId}
      threads={threads}
      rolePrefix="admin"
      userFirstName={userFirstName}
    />
  );
}
