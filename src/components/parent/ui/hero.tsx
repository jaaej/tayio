import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The indigo gradient used across the v2 portals' hero strips. */
const HERO_BG =
  "radial-gradient(120% 140% at 0% 0%, #A0BFFC 0%, transparent 45%), radial-gradient(110% 150% at 100% 10%, #7A9BF5 0%, transparent 52%), linear-gradient(125deg, #4F5BD5 0%, #3F4AB5 58%, #2B3287 100%)";

/** Translucent chip for use inside <Hero>. */
export function HeroChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold tabular-nums bg-white/[0.18] border border-white/25">
      {children}
    </span>
  );
}

/** Indigo gradient hero — mirrors the student board hero. */
export function Hero({
  eyebrow,
  title,
  sub,
  icon,
  chips,
  right,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  chips?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[28px] px-7 py-7 lg:px-8 lg:py-8 text-white shadow-[0_20px_44px_-22px_rgba(31,40,90,0.5)]",
        className,
      )}
      style={{ background: HERO_BG }}
    >
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="absolute -right-8 -top-10 w-[260px] h-[260px] opacity-30 pointer-events-none"
        fill="none"
      >
        <circle cx="70" cy="30" r="30" fill="rgba(255,255,255,0.40)" />
        <circle cx="70" cy="30" r="20" fill="rgba(255,255,255,0.40)" />
        <circle cx="70" cy="30" r="10" fill="rgba(255,255,255,0.50)" />
      </svg>

      <div className="relative z-10 flex items-center gap-5">
        {icon && (
          <div className="h-[72px] w-[72px] rounded-[22px] grid place-items-center text-[28px] font-bold bg-white/[0.18] border border-white/30 backdrop-blur-sm shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className="text-[11px] uppercase tracking-[0.2em] font-bold opacity-80">
              {eyebrow}
            </div>
          )}
          <h1 className="mt-2 text-[26px] lg:text-[32px] font-extrabold tracking-[-0.02em] leading-[1.05]">
            {title}
          </h1>
          {sub && (
            <p className="mt-2 text-[13px] text-white/80 max-w-xl">{sub}</p>
          )}
          {chips && <div className="mt-4 flex flex-wrap gap-2">{chips}</div>}
        </div>
        {right && <div className="relative z-10 shrink-0">{right}</div>}
      </div>
    </section>
  );
}
