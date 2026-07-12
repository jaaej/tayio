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
    <div className="flex flex-col gap-6 w-full">
      <div
        className="relative overflow-hidden rounded-[28px] p-8 lg:p-10 text-white shadow-sm"
        style={{
          backgroundImage:
            "linear-gradient(120deg, #7B6EF0 0%, #6D3BD6 55%, #5A21B0 100%)",
        }}
      >
        <div className="absolute -right-12 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl blitz-float" />
        <div
          className="absolute -left-10 -bottom-28 h-64 w-64 rounded-full bg-white/5 blur-2xl blitz-float"
          style={{ animationDelay: "-3.5s" }}
        />
        <div className="relative flex items-center gap-5">
          <div className="hidden sm:grid h-16 w-16 shrink-0 place-items-center rounded-[20px] bg-white/15">
            <Zap className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-[30px] lg:text-[38px] font-extrabold tracking-tight leading-none">
              Math Blitz
            </h1>
            <p className="text-[14px] lg:text-[16px] text-white/85 mt-2.5">
              Solve as many as you can in 60 seconds. Pick a level and climb the
              board.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[12px] font-semibold">
              <span className="rounded-full bg-white/15 px-3 py-1.5">5 levels</span>
              <span className="rounded-full bg-white/15 px-3 py-1.5">60 seconds</span>
              <span className="rounded-full bg-white/15 px-3 py-1.5">Live leaderboard</span>
            </div>
          </div>
        </div>
      </div>

      <DifficultyPicker myBests={myBests} />
      <Leaderboard boards={boards} />
    </div>
  );
}
