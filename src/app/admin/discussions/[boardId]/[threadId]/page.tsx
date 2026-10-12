import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button, GlassPanel } from "@/components/admin/ui";
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

  const liveReplies = thread.replies.filter((r) => !r.deletedAt);

  return (
    <DiscussionThreadDetail
      thread={thread}
      boardId={boardId}
      rolePrefix="admin"
      aside={
        <GlassPanel
          as="aside"
          title="Admin controls"
          titleId="moderation-heading"
          bodyClassName="flex flex-col gap-2.5 p-3.5"
        >
          {!thread.deletedAt && (
            <form action={softDelete}>
              <input type="hidden" name="kind" value="thread" />
              <input type="hidden" name="id" value={thread.id} />
              <Button
                type="submit"
                variant="outline"
                className="h-10 w-full rounded-[11px] border-[#F2C6C2] text-bad hover:bg-[#FEF3F2]"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Remove thread
              </Button>
            </form>
          )}
          {liveReplies.length > 0 ? (
            <>
              <span className="px-0.5 pt-1 text-[12px] text-muted">
                Remove a single reply
              </span>
              {liveReplies.map((r) => (
                <form action={softDelete} key={r.id}>
                  <input type="hidden" name="kind" value="reply" />
                  <input type="hidden" name="id" value={r.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    className="h-auto min-h-9 w-full flex-col items-start gap-0 whitespace-normal py-1.5 text-left"
                  >
                    <span>Remove reply by {r.authorName}</span>
                    <span className="line-clamp-1 w-full text-[12px] font-medium text-muted">
                      {r.body}
                    </span>
                  </Button>
                </form>
              ))}
            </>
          ) : (
            <span className="px-0.5 text-[12px] text-muted">No replies to manage.</span>
          )}
          <p className="px-0.5 pt-1 text-[12px] leading-[1.45] text-muted">
            Removed posts show as &ldquo;[removed by admin]&rdquo; to everyone else.
          </p>
        </GlassPanel>
      }
    />
  );
}
