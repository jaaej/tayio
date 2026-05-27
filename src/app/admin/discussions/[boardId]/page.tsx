import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
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
  if (board.kind === "subject") {
    const subj = await db
      .select({ name: subjects.name, yearLevel: subjects.yearLevel })
      .from(subjects)
      .where(eq(subjects.id, board.subjectId))
      .limit(1);
    if (subj.length === 0) notFound();
    label = subjectBoardLabel(subj[0]);
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/discussions"
        className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-muted hover:text-ink font-medium"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        Discussions
      </Link>
      <header>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Board
        </div>
        <h1 className="mt-1 text-3xl lg:text-4xl font-medium tracking-tight text-ink">
          {label}
        </h1>
      </header>
      <NewThreadForm boardSegment={boardId} rolePrefix="admin" />
      <ThreadList
        threads={threads}
        hrefPrefix={`/admin/discussions/${boardId}`}
      />
    </div>
  );
}
