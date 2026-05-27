import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { BoardSummary } from "@/lib/discussions-queries";
import { boardSegment } from "@/lib/discussions";

export function BoardCard({
  board,
  hrefPrefix,
}: {
  board: BoardSummary;
  hrefPrefix: string;
}) {
  const href = `${hrefPrefix}/${boardSegment(board.id)}`;
  const isAdmin = board.id.kind === "admin";

  const lastActive = board.lastActivityAt
    ? board.lastActivityAt.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <Link
      href={href}
      className="group block h-full transition-all duration-200 hover:-translate-y-0.5"
    >
      <Card className="h-full p-5 transition-shadow group-hover:shadow-[0_18px_38px_-18px_rgba(29,41,81,0.32)]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-muted">
            {isAdmin ? "General help" : "Subject board"}
          </span>
          <ChevronRight
            className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </div>
        <div className="text-lg font-semibold text-ink leading-tight tracking-tight">
          {board.label}
        </div>
        <div className="mt-5 pt-4 border-t border-hairline/60 flex items-center justify-between text-xs text-ink-soft">
          <span className="tabular-nums font-medium">
            {board.threadCount} {board.threadCount === 1 ? "thread" : "threads"}
          </span>
          <span className="text-[11px] uppercase tracking-[0.14em] font-medium">
            {lastActive ? `Active ${lastActive}` : "No threads yet"}
          </span>
        </div>
      </Card>
    </Link>
  );
}
