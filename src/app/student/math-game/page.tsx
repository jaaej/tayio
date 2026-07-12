import { Zap } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getLeaderboard, getMyBests } from "./_queries";
import { DifficultyPicker } from "./_components/difficulty-picker";
import { Leaderboard, type Boards } from "./_components/leaderboard";
import type { Difficulty } from "./_components/question-generator";

const DIFFICULTIES: Difficulty[] = ["sprint", "easy", "medium", "hard", "genius"];

export default async function MathGamePage() {
  const user = await requireRole("student");

  const [myBests, ...boardList] = await Promise.all([
    getMyBests(user.id),
    ...DIFFICULTIES.map((d) => getLeaderboard(d, user.id)),
  ]);

  const boards = Object.fromEntries(
    DIFFICULTIES.map((d, i) => [d, boardList[i]]),
  ) as Boards;

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div
        className="relative overflow-hidden rounded-[24px] p-7 lg:p-8 text-white shadow-sm"
        style={{
          backgroundImage:
            "linear-gradient(120deg, #7B6EF0 0%, #6D3BD6 55%, #5A21B0 100%)",
        }}
      >
        <div className="absolute -right-12 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -left-10 -bottom-24 h-56 w-56 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="hidden sm:grid h-14 w-14 shrink-0 place-items-center rounded-[16px] bg-white/15">
            <Zap className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-[26px] lg:text-[30px] font-extrabold tracking-tight leading-none">
              Math Blitz
            </h1>
            <p className="text-[13px] lg:text-[14px] text-white/85 mt-2">
              Solve as many as you can in 60 seconds. Pick a level and climb the
              board.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
              <span className="rounded-full bg-white/15 px-2.5 py-1">5 levels</span>
              <span className="rounded-full bg-white/15 px-2.5 py-1">60 seconds</span>
              <span className="rounded-full bg-white/15 px-2.5 py-1">Live leaderboard</span>
            </div>
          </div>
        </div>
      </div>

      <DifficultyPicker myBests={myBests} />
      <Leaderboard boards={boards} />
    </div>
  );
}
