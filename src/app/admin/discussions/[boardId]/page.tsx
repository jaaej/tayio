import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { MessageSquareText, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import {
  canSeeBoard,
  listThreadsForBoard,
} from "@/lib/discussions-queries";
import {
  adminBoardLabel,
  resolveBoardId,
  subjectBoardLabel,
} from "@/lib/discussions";
import { ThreadList } from "@/components/discussions/thread-list";
import { NewThreadForm } from "@/components/discussions/new-thread-form";
import { BackLink, Hero, HeroChip } from "@/components/admin/ui";
import { db } from "@/db/client";
import { subjects } from "@/db/schema";

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

  let label = adminBoardLabel();
  let eyebrow = "Admin / Tech board";
  if (board.kind === "subject") {
    const subj = await db
      .select({ name: subjects.name, yearLevel: subjects.yearLevel })
      .from(subjects)
      .where(eq(subjects.id, board.subjectId))
      .limit(1);
    if (subj.length === 0) notFound();
    label = subjectBoardLabel(subj[0]);
    eyebrow = "Subject board";
  }

  const totalReplies = threads.reduce((sum, t) => sum + t.replyCount, 0);
  const uniqueAuthors = new Set(threads.map((t) => t.authorName)).size;

  return (
    <div className="space-y-6 max-w-5xl">
      <BackLink href="/admin/discussions">Discussions</BackLink>

      <Hero
        eyebrow={eyebrow}
        title={label}
        icon={label.charAt(0).toUpperCase()}
        chips={
          <>
            <HeroChip>
              <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
              {threads.length} {threads.length === 1 ? "thread" : "threads"}
            </HeroChip>
            <HeroChip>
              {totalReplies} {totalReplies === 1 ? "reply" : "replies"}
            </HeroChip>
            {uniqueAuthors > 0 && (
              <HeroChip>
                <Users className="h-3.5 w-3.5" aria-hidden />
                {uniqueAuthors}
              </HeroChip>
            )}
          </>
        }
      />

      <NewThreadForm boardSegment={boardId} rolePrefix="admin" />
      <ThreadList
        threads={threads}
        hrefPrefix={`/admin/discussions/${boardId}`}
      />
    </div>
  );
}
