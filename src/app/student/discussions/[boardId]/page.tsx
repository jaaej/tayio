import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ChevronLeft, MessageSquareText, Users } from "lucide-react";
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
import { BoardInteractive } from "@/components/student/discussions/board-interactive";
import {
  colorFamilyForSubject,
  getAccentTokens,
  type AccentTokens,
} from "@/lib/subject-colors";
import { db } from "@/db/client";
import { subjects } from "@/db/schema";

const GENERIC_TOKENS: AccentTokens = {
  bgFrom: "rgb(208, 219, 252)",
  bgTo: "rgb(229, 235, 254)",
  ring: "rgb(126, 145, 220)",
  title: "#1a1f4d",
  meta: "rgba(26, 31, 77, 0.85)",
  arrow: "#4f5bd5",
  pillBg: "#e0e7ff",
  pillText: "#3730a3",
};

export default async function StudentBoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const user = await requireRole("student");
  const board = resolveBoardId(boardId);
  if (!board) notFound();
  if (!(await canSeeBoard(user.id, "student", board))) notFound();

  const threads = await listThreadsForBoard(board);

  let label = adminBoardLabel();
  let tokens = GENERIC_TOKENS;
  let eyebrow = "General help";
  if (board.kind === "subject") {
    const subj = await db
      .select({ name: subjects.name, yearLevel: subjects.yearLevel })
      .from(subjects)
      .where(eq(subjects.id, board.subjectId))
      .limit(1);
    if (subj.length === 0) notFound();
    label = subjectBoardLabel(subj[0]);
    tokens = getAccentTokens(colorFamilyForSubject(label));
    eyebrow = "Subject board";
  }

  const userFirstName =
    (user.user_metadata?.first_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "you";

  const initial = label.charAt(0).toUpperCase();
  const totalReplies = threads.reduce((sum, t) => sum + t.replyCount, 0);
  const uniqueAuthors = new Set(threads.map((t) => t.authorName)).size;

  return (
    <div className="space-y-6">
      <Link
        href="/student/discussions"
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] font-bold text-muted hover:text-ink transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        Discussions
      </Link>

      <section
        className="relative overflow-hidden rounded-[28px] px-8 py-8 text-white shadow-[0_20px_44px_-22px_rgba(31,40,90,0.5)]"
        style={{
          background: `radial-gradient(120% 140% at 0% 0%, rgba(255,255,255,0.18) 0%, transparent 50%), linear-gradient(135deg, ${tokens.arrow} 0%, ${tokens.title} 100%)`,
        }}
      >
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          className="absolute -right-8 -top-10 w-[260px] h-[260px] opacity-30 pointer-events-none"
          fill="none"
        >
          <circle cx="70" cy="30" r="30" fill="rgba(255,255,255,0.40)" />
          <circle cx="70" cy="30" r="20" fill="rgba(255,255,255,0.40)" />
          <circle cx="70" cy="30" r="10" fill="rgba(255,255,255,0.50)" />
        </svg>

        <div className="relative z-10 flex items-center gap-6">
          <div className="h-[72px] w-[72px] rounded-[22px] grid place-items-center text-[28px] font-bold bg-white/[0.18] border border-white/30 backdrop-blur-sm shrink-0">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[0.2em] font-bold opacity-80">
              {eyebrow}
            </div>
            <h1 className="mt-2 text-[32px] lg:text-[36px] font-bold tracking-[-0.02em] leading-[1.05]">
              {label}
            </h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold tabular-nums bg-white/[0.18] border border-white/25">
                <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
                {threads.length} {threads.length === 1 ? "thread" : "threads"}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold tabular-nums bg-white/[0.18] border border-white/25">
                {totalReplies} {totalReplies === 1 ? "reply" : "replies"}
              </span>
              {uniqueAuthors > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold tabular-nums bg-white/[0.18] border border-white/25">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  {uniqueAuthors}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <BoardInteractive
        threads={threads}
        hrefPrefix={`/student/discussions/${boardId}`}
        boardSegment={boardId}
        tokens={tokens}
        userFirstName={userFirstName}
      />
    </div>
  );
}
