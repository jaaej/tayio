import { Trophy } from "lucide-react";
import type { BoardRow } from "@/lib/term-test";

const MEDAL: Record<number, string> = {
  1: "#f5b301",
  2: "#9aa4b2",
  3: "#cd7f32",
};

function Row({ row }: { row: BoardRow }) {
  const medal = MEDAL[row.rank];
  return (
    <div
      className={`flex items-center justify-between px-3 py-2.5 rounded-[12px] text-[13px] ${
        row.isMe ? "bg-brand-50 text-brand-700" : "text-ink hover:bg-surface-2"
      }`}
    >
      <span className="flex items-center gap-3 min-w-0">
        <span
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums text-muted"
          style={medal ? { backgroundColor: `${medal}22`, color: medal } : undefined}
        >
          {row.rank}
        </span>
        <span className={`truncate ${row.isMe ? "font-bold" : "font-medium"}`}>
          {row.name}
          {row.isMe && <span className="text-brand-500"> (you)</span>}
        </span>
      </span>
      <span className="tabular-nums font-extrabold">{row.score}</span>
    </div>
  );
}

/**
 * Single-board leaderboard for a term test - no difficulty tabs, unlike the
 * math-game version this is adapted from. Title is supplied by the caller
 * (subject + term) since the board itself carries no subject/term identity.
 */
export function TermTestLeaderboard({
  title,
  board,
}: {
  title: string;
  board: { top: BoardRow[]; me: BoardRow | null };
}) {
  return (
    <div className="rounded-[18px] border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-[18px] w-[18px] text-brand-500" />
        <h2 className="text-[16px] font-extrabold text-ink tracking-tight">
          {title}
        </h2>
      </div>

      {board.top.length === 0 ? (
        <div className="py-10 text-center text-[13px] text-muted">
          No scores yet - be the first to set one!
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
            <span>Student</span>
            <span>Score</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {board.top.map((r) => (
              <Row key={r.rank} row={r} />
            ))}
            {board.me && (
              <>
                <div className="text-center text-muted text-[11px] py-1">···</div>
                <Row row={board.me} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
