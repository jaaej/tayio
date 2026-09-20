import { Zap } from "lucide-react";
import { requireRole } from "@/lib/auth";
import {
  getLeaderboardBoards,
  getMyBests,
  getOverallBlitzRank,
  getStudentYearLevel,
} from "./_queries";
import { DifficultyPicker } from "./_components/difficulty-picker";
import { Leaderboard } from "./_components/leaderboard";
import { BlitzBackdrop } from "./_components/blitz-backdrop";

export default async function MathGamePage() {
  const user = await requireRole("student");
  const yearLevel = await getStudentYearLevel(user.id);
  const [myBests, allBoards, yearBoards, overallRank] = await Promise.all([
    getMyBests(user.id),
    getLeaderboardBoards(user.id),
    yearLevel ? getLeaderboardBoards(user.id, yearLevel) : Promise.resolve(null),
    getOverallBlitzRank(user.id),
  ]);

  return (
    <div className="relative">
      <BlitzBackdrop />
      <div className="relative z-10 flex flex-col gap-6 w-full">
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
              Taiyo Blitz
            </h1>
            <p className="text-[14px] lg:text-[16px] text-white/85 mt-2.5">
              Solve as many as you can in 60 seconds. Pick a level and climb the
              board.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[12px] font-semibold">
              <span className="rounded-full bg-white/15 px-3 py-1.5">5 levels</span>
              <span className="rounded-full bg-white/15 px-3 py-1.5">60 seconds</span>
              <span className="rounded-full bg-white/15 px-3 py-1.5">Live leaderboard</span>
              <span className="rounded-full bg-white px-3 py-1.5 font-extrabold text-[#5A21B0]">
                {overallRank
                  ? `Your Taiyo rank #${overallRank.rank} of ${overallRank.totalPlayers}`
                  : "Play once to earn your rank"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <DifficultyPicker myBests={myBests} />
      <Leaderboard
        allBoards={allBoards}
        yearBoards={yearBoards}
        yearLevel={yearLevel}
      />
      </div>
    </div>
  );
}
