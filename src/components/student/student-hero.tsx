import { Star, Medal } from "lucide-react";

/**
 * Hero block — blue gradient with avatar, level/year chips, and XP bar.
 *
 * Gamification numbers are static placeholders until the schema tracks
 * XP / levels. Real props: firstName, initials, yearLevel.
 */
export function StudentHero({
  firstName,
  initials,
  yearLevel,
  level = 1,
  rank,
  xpCurrent = 0,
  xpToNext = 500,
}: {
  firstName: string;
  initials: string;
  yearLevel?: string | null;
  level?: number;
  rank?: number;
  xpCurrent?: number;
  xpToNext?: number;
}) {
  const xpPct = Math.max(
    0,
    Math.min(100, (xpCurrent / Math.max(1, xpToNext)) * 100),
  );

  return (
    <section
      className="relative overflow-hidden rounded-[28px] px-7 py-6 text-white flex items-center gap-6 shadow-[0_20px_44px_-22px_rgba(50,58,145,0.6)]"
      style={{
        background: `radial-gradient(120% 140% at 0% 0%, #A0BFFC 0%, transparent 45%), radial-gradient(110% 150% at 100% 10%, #7A9BF5 0%, transparent 52%), linear-gradient(125deg, #4F5BD5 0%, #3F4AB5 58%, #2B3287 100%)`,
      }}
    >
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="absolute -right-8 -top-10 w-[220px] h-[220px] opacity-50 pointer-events-none"
        fill="none"
      >
        <circle cx="70" cy="30" r="30" fill="rgba(255,255,255,0.10)" />
        <circle cx="70" cy="30" r="20" fill="rgba(255,255,255,0.10)" />
        <circle cx="70" cy="30" r="10" fill="rgba(255,255,255,0.12)" />
      </svg>

      <div className="relative z-10 flex items-center gap-[18px]">
        <div className="h-[76px] w-[76px] rounded-[22px] grid place-items-center text-[28px] font-extrabold text-white border-2 border-white/50 bg-white/[0.16] backdrop-blur-sm shrink-0">
          {initials}
        </div>
        <div>
          <h2 className="m-0 text-[24px] font-extrabold tracking-[-0.02em]">
            Hey {firstName} 👋
          </h2>
          <div className="flex flex-wrap gap-2 mt-2">
            {yearLevel && (
              <span className="inline-flex items-center gap-1.5 bg-white/[0.18] border border-white/25 px-2.5 py-1 rounded-full text-[12px] font-bold">
                {yearLevel}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 bg-white/[0.18] border border-white/25 px-2.5 py-1 rounded-full text-[12px] font-bold">
              <Star className="h-3.5 w-3.5" /> Level {level}
            </span>
            {typeof rank === "number" && (
              <span className="inline-flex items-center gap-1.5 bg-white/[0.18] border border-white/25 px-2.5 py-1 rounded-full text-[12px] font-bold">
                <Medal className="h-3.5 w-3.5" /> Rank #{rank} in class
              </span>
            )}
          </div>

          <div className="mt-3.5 max-w-[360px]">
            <div className="flex justify-between text-[11px] font-bold mb-1.5 opacity-95">
              <span>Level {level}</span>
              <span>
                {xpCurrent} / {xpToNext} XP
              </span>
            </div>
            <div className="h-[9px] rounded-full bg-white/[0.22] overflow-hidden">
              <div
                className="h-full rounded-full shadow-[0_0_12px_rgba(255,255,255,0.6)]"
                style={{
                  width: `${xpPct}%`,
                  background: "linear-gradient(90deg, #FFE9C7, #FFFFFF)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
