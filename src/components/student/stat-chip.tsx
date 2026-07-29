import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Hue = "brand" | "sun" | "mint" | "grape" | "sky" | "coral";

const HUE_BG: Record<Hue, string> = {
  brand: "bg-brand-50 text-brand-500",
  sun:   "bg-sun-100 text-sun-600",
  mint:  "bg-mint-bg text-mint",
  grape: "bg-grape-bg text-grape",
  sky:   "bg-sky-bg text-sky",
  coral: "bg-coral-bg text-coral",
};

/**
 * Stat chip - coloured icon tile + big value + small label.
 * Used in the dashboard's chip row.
 */
export function StatChip({
  icon,
  value,
  label,
  hue = "brand",
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  hue?: Hue;
}) {
  return (
    <div className="bg-surface border border-line rounded-[14px] p-3.5 flex items-center gap-3 shadow-[0_1px_0_rgba(15,17,30,0.04),0_1px_2px_rgba(15,17,30,0.04)]">
      <div
        className={cn(
          "h-[42px] w-[42px] rounded-[13px] grid place-items-center shrink-0 text-[20px]",
          HUE_BG[hue],
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[20px] font-extrabold tracking-[-0.02em] leading-none text-ink">
          {value}
        </div>
        <div className="text-[11px] font-bold text-muted mt-1">{label}</div>
      </div>
    </div>
  );
}
