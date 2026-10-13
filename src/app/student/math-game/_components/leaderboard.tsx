"use client";

import { useState } from "react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { cn } from "@/lib/utils";
import type { Difficulty } from "./question-generator";
import { LEVELS, levelInfo } from "./level-info";
import { formatYear } from "./standing";
import type { LeaderboardBoards, LeaderboardRow } from "../_queries";

/** Podium look per place, from the design: block colour, avatar ring and size. */
const PODIUM: Record<number, { block: string; ring: string; avatar: string; height: number }> = {
  1: { block: "#FFD600", ring: "#FFD600", avatar: "h-[54px] w-[54px]", height: 96 },
  2: { block: "#DADCE6", ring: "#C7CAD8", avatar: "h-11 w-11", height: 70 },
  3: { block: "#F4B886", ring: "#F0A56A", avatar: "h-11 w-11", height: 56 },
};

export function Leaderboard({
  allBoards,
  yearBoards,
  yearLevel,
  level,
  onLevelChange,
}: {
  allBoards: LeaderboardBoards;
  yearBoards: LeaderboardBoards | null;
  yearLevel: string | null;
  level: Difficulty;
  onLevelChange: (level: Difficulty) => void;
}) {
  const [scope, setScope] = useState<"year" | "all">(yearBoards ? "year" : "all");
  const board = (scope === "year" && yearBoards ? yearBoards : allBoards)[level];
  const podium = board.top.slice(0, 3);
  const rest = board.top.slice(3);
  const scopes = [
    ...(yearBoards ? [{ key: "year" as const, label: formatYear(yearLevel) }] : []),
    { key: "all" as const, label: "All Taiyo" },
  ];

  return (
    <section
      id="blitz-leaderboard"
      aria-labelledby="lb-h"
      className="glass min-w-[min(300px,100%)] max-w-[440px] flex-[1_1_360px] scroll-mt-36 rounded-[24px] p-1.5 lg:scroll-mt-5"
    >
      <div className="flex flex-col gap-2 pb-2 pl-3 pr-1.5 pt-1.5">
        <div className="flex items-center justify-between gap-2">
          <h2 id="lb-h" className="text-[16px] font-extrabold text-ink">
            Leaderboard
          </h2>
          <div
            role="tablist"
            aria-label="Scope"
            className="flex gap-0.5 rounded-[10px] border border-white/90 bg-white/60 p-[3px]"
          >
            {scopes.map((option) => (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={scope === option.key}
                onClick={() => setScope(option.key)}
                className={cn(
                  "h-7 rounded-[7px] px-2.5 text-[12px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                  scope === option.key ? "bg-ink text-white" : "text-ink-soft",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div
          role="tablist"
          aria-label="Level"
          className="flex gap-0.5 rounded-[10px] border border-white/90 bg-white/60 p-[3px]"
        >
          {LEVELS.map((option) => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={level === option.key}
              onClick={() => onLevelChange(option.key)}
              className={cn(
                "h-7 min-w-0 flex-1 rounded-[7px] text-[12px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                level === option.key ? "bg-ink text-white" : "text-ink-soft",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel overflow-hidden">
        {board.top.length === 0 ? (
          <p className="px-5 py-12 text-center text-[14px] text-muted">
            No scores yet. Play {levelInfo(level).label} to set the first one.
          </p>
        ) : (
          <>
            <ol className="grid grid-cols-3 items-end gap-2 px-3.5 pt-5">
              {[podium[1], podium[0], podium[2]].map((row, index) =>
                row ? <PodiumPlace key={row.rank} row={row} /> : <li key={`empty-${index}`} aria-hidden />,
              )}
            </ol>
            <ol>
              {rest.map((row) => (
                <Row key={row.rank} row={row} />
              ))}
              {board.me && <Row row={board.me} />}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}

function PodiumPlace({ row }: { row: LeaderboardRow }) {
  const look = PODIUM[row.rank];
  return (
    <li className="flex min-w-0 flex-col items-center gap-1.5">
      <span className="rounded-full border-[3px]" style={{ borderColor: look.ring }}>
        <ProfileAvatar
          avatarKey={row.avatarKey}
          fallback={row.initials}
          className={cn("shrink-0 text-[13px] font-extrabold", look.avatar)}
        />
      </span>
      <span className="max-w-full truncate text-center text-[12px] font-extrabold text-ink" title={row.name}>
        {row.isMe ? `${row.name} (you)` : row.name}
      </span>
      <span
        className="flex w-full flex-col items-center justify-center gap-0.5 rounded-t-[12px] leading-[1.1] text-[#1B1240]"
        style={{ height: look.height, background: look.block }}
      >
        <span className="text-[12px] font-extrabold opacity-70">#{row.rank}</span>
        <span className="text-[20px] font-extrabold tabular-nums">{row.score}</span>
      </span>
    </li>
  );
}

function Row({ row }: { row: LeaderboardRow }) {
  return (
    <li
      className="flex items-center gap-2.5 border-t border-[#EFF0F5] px-3.5 py-2.5"
      style={{ background: row.isMe ? "#FFF7D6" : "#FFFFFF" }}
    >
      <span className="w-[26px] text-center text-[13px] font-extrabold tabular-nums text-muted">{row.rank}</span>
      <ProfileAvatar
        avatarKey={row.avatarKey}
        fallback={row.initials}
        className="h-[30px] w-[30px] shrink-0 text-[11px] font-extrabold"
      />
      <span className={cn("min-w-0 flex-1 truncate text-[14px] text-ink", row.isMe ? "font-extrabold" : "font-semibold")}>
        {row.isMe ? `${row.name} (you)` : row.name}
      </span>
      <span className="text-[15px] font-extrabold tabular-nums text-ink">{row.score}</span>
    </li>
  );
}
