import { requireRole } from "@/lib/auth";
import { getLeaderboard, getMyBests } from "./_queries";
import { DifficultyPicker } from "./_components/difficulty-picker";
import { Leaderboard, type Boards } from "./_components/leaderboard";
import type { Difficulty } from "./_components/question-generator";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "genius"];

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
    <div className="flex flex-col gap-6 max-w-3xl">
      <div
        className="relative overflow-hidden rounded-[24px] p-6 text-white shadow-sm"
        style={{
          backgroundImage:
            "linear-gradient(120deg, #7B6EF0 0%, #6D3BD6 55%, #5A21B0 100%)",
        }}
      >
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="text-[22px] font-extrabold tracking-tight">
            Math Sprint 🧮
          </div>
          <div className="text-[13px] text-white/85 mt-1">
            Solve as many as you can in 60 seconds. Pick a difficulty and go.
          </div>
        </div>
      </div>

      <DifficultyPicker myBests={myBests} />
      <Leaderboard boards={boards} />
    </div>
  );
}
