import { Medal } from "lucide-react";

/**
 * Hero block - blue gradient with avatar and year / class-rank chips.
 *
 * Real props only: firstName, initials, yearLevel, and (when available) the
 * student's class rank. XP / levels were removed - there is no schema behind
 * them, so showing frozen placeholder numbers is not shipped.
 */
export function StudentHero({
  firstName,
  initials,
  yearLevel,
  rank,
}: {
  firstName: string;
  initials: string;
  yearLevel?: string | null;
  rank?: number;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-[22px] px-5 py-5 text-white flex items-center gap-4 shadow-[0_20px_44px_-22px_rgba(50,58,145,0.6)] sm:rounded-[28px] sm:px-7 sm:py-6 sm:gap-6"
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

      <div className="relative z-10 flex min-w-0 items-center gap-3 sm:gap-[18px]">
        <div className="h-14 w-14 rounded-[18px] grid place-items-center text-[22px] font-extrabold text-white border-2 border-white/50 bg-white/[0.16] backdrop-blur-sm shrink-0 sm:h-[76px] sm:w-[76px] sm:rounded-[22px] sm:text-[28px]">
          {initials}
        </div>
        <div className="min-w-0">
          <h2 className="m-0 text-[20px] font-extrabold tracking-[-0.02em] sm:text-[24px]">
            Hey {firstName} 👋
          </h2>
          <div className="flex flex-wrap gap-2 mt-2">
            {yearLevel && (
              <span className="inline-flex items-center gap-1.5 bg-white/[0.18] border border-white/25 px-2.5 py-1 rounded-full text-[12px] font-bold">
                {yearLevel}
              </span>
            )}
            {typeof rank === "number" && (
              <span className="inline-flex items-center gap-1.5 bg-white/[0.18] border border-white/25 px-2.5 py-1 rounded-full text-[12px] font-bold">
                <Medal className="h-3.5 w-3.5" /> Rank #{rank} in class
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
