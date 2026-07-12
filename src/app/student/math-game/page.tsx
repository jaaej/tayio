import { Zap } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getLeaderboard, getMyBests } from "./_queries";
import { DifficultyPicker } from "./_components/difficulty-picker";
import { Leaderboard, type Boards } from "./_components/leaderboard";
import type { Difficulty } from "./_components/question-generator";

const DIFFICULTIES: Difficulty[] = ["sprint", "easy", "medium", "hard", "genius"];

// Ambient drifting math symbols behind the page (decorative, low opacity).
const FLOATERS = [
  { c: "+", top: "9%", left: "5%", size: 66, color: "#7b5bd6", delay: "0s" },
  { c: "×", top: "16%", left: "86%", size: 54, color: "#2e8fd6", delay: "-2s" },
  { c: "−", top: "44%", left: "11%", size: 74, color: "#1fa974", delay: "-4s" },
  { c: "÷", top: "58%", left: "82%", size: 60, color: "#f58a07", delay: "-1.2s" },
  { c: "=", top: "80%", left: "20%", size: 62, color: "#f2616b", delay: "-3s" },
  { c: "+", top: "72%", left: "58%", size: 48, color: "#5b5bd6", delay: "-5s" },
  { c: "×", top: "34%", left: "47%", size: 46, color: "#1fa974", delay: "-2.6s" },
  { c: "÷", top: "24%", left: "64%", size: 52, color: "#f2616b", delay: "-4.4s" },
  { c: "8", top: "87%", left: "70%", size: 56, color: "#2e8fd6", delay: "-1.8s" },
  { c: "5", top: "50%", left: "92%", size: 50, color: "#7b5bd6", delay: "-3.6s" },
];

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
    <div
      className="relative -mx-5 lg:-mx-7 -my-6 lg:-mb-16 min-h-full overflow-hidden px-5 lg:px-7 pt-6 pb-6 lg:pb-16"
      style={{
        backgroundImage:
          "linear-gradient(180deg, #f7f9ff 0%, #eef3fd 60%, #f4f7ff 100%)",
      }}
    >
      {FLOATERS.map((f, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute select-none font-extrabold blitz-drift"
          style={{
            top: f.top,
            left: f.left,
            fontSize: f.size,
            color: f.color,
            opacity: 0.12,
            animationDelay: f.delay,
          }}
        >
          {f.c}
        </span>
      ))}
      <div className="relative flex flex-col gap-6 w-full">
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
    </div>
  );
}
