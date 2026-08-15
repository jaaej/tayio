import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Card, CardHead, CardBody, Button } from "@/components/admin/ui";
import { requireRole } from "@/lib/auth";
import {
  canSeeBoard,
  getThreadWithReplies,
} from "@/lib/discussions-queries";
import { resolveBoardId } from "@/lib/discussions";
import { DiscussionThreadDetail } from "@/components/discussions/thread-detail";
import { softDelete } from "@/app/_actions/discussions";

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

  const userFirstName =
    (user.user_metadata?.first_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "you";

  const liveReplies = thread.replies.filter((r) => !r.deletedAt);

  return (
    <DiscussionThreadDetail
      thread={thread}
      boardId={boardId}
      rolePrefix="admin"
      userFirstName={userFirstName}
      moderation={
        <Card accent="coral">
          <CardHead title="Admin controls" eyebrow="Moderation" />
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {!thread.deletedAt && (
                <form action={softDelete}>
                  <input type="hidden" name="kind" value="thread" />
                  <input type="hidden" name="id" value={thread.id} />
                  <Button type="submit" variant="danger" size="sm">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Remove thread
                  </Button>
                </form>
              )}
              {liveReplies.map((r) => (
                <form action={softDelete} key={r.id}>
                  <input type="hidden" name="kind" value="reply" />
                  <input type="hidden" name="id" value={r.id} />
                  <Button type="submit" variant="danger" size="sm">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Remove reply by {r.authorName}
                  </Button>
                </form>
              ))}
              {!thread.deletedAt && liveReplies.length === 0 && (
                <span className="text-[12px] text-muted italic">
                  No replies to manage.
                </span>
              )}
            </div>
          </CardBody>
        </Card>
      }
    />
  );
}
