"use client";

import { useState } from "react";
import type { Difficulty } from "./question-generator";
import type { LeaderboardRow } from "../_queries";

const TABS: { key: Difficulty; label: string }[] = [
  { key: "easy", label: "Easy" },
  { key: "medium", label: "Medium" },
  { key: "hard", label: "Hard" },
  { key: "genius", label: "Genius" },
];

export type Boards = Record<
  Difficulty,
  { top: LeaderboardRow[]; me: LeaderboardRow | null }
>;

function Row({ row }: { row: LeaderboardRow }) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-[10px] text-[13px] ${
        row.isMe ? "bg-brand-50 font-semibold text-brand-700" : "text-ink"
      }`}
    >
      <span className="flex items-center gap-3">
        <span className="w-6 text-muted tabular-nums">{row.rank}</span>
        <span>{row.name}</span>
      </span>
      <span className="tabular-nums font-semibold">{row.score}</span>
    </div>
  );
}

export function Leaderboard({ boards }: { boards: Boards }) {
  const [tab, setTab] = useState<Difficulty>("easy");
  const board = boards[tab];

  return (
    <div className="rounded-[14px] border border-line bg-surface p-4">
      <div className="flex gap-1 mb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`h-8 px-3 rounded-full text-[12px] font-semibold transition-colors ${
              tab === t.key
                ? "bg-brand-500 text-white"
                : "text-muted hover:bg-surface-2"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {board.top.length === 0 ? (
        <div className="py-8 text-center text-[13px] text-muted">
          No scores yet — be the first!
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {board.top.map((r) => (
            <Row key={`${r.rank}-${r.name}`} row={r} />
          ))}
          {board.me && (
            <>
              <div className="text-center text-muted text-[11px] py-1">···</div>
              <Row row={board.me} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
