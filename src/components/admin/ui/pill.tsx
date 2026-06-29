import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PillTone =
  | "default"
  | "brand"
  | "good"
  | "warn"
  | "bad"
  | "info"
  | "mint"
  | "grape"
  | "sky"
  | "coral"
  | "sun";

const TONE: Record<PillTone, string> = {
  default: "bg-surface-2 text-ink-soft border-line",
  brand: "bg-brand-50 text-brand-700 border-transparent",
  good: "bg-good-bg text-good border-transparent",
  warn: "bg-warn-bg text-warn border-transparent",
  bad: "bg-bad-bg text-bad border-transparent",
  info: "bg-info-bg text-info border-transparent",
  mint: "bg-mint-bg text-mint border-transparent",
  grape: "bg-grape-bg text-grape border-transparent",
  sky: "bg-sky-bg text-sky border-transparent",
  coral: "bg-coral-bg text-coral border-transparent",
  sun: "bg-sun-100 text-sun-600 border-transparent",
};

/** Pill / chip — the reference `.pill`. */
export function Pill({
  tone = "default",
  dot,
  className,
  children,
}: {
  tone?: PillTone;
  /** Show a small leading status dot in the current colour. */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold tabular-nums",
        TONE[tone],
        className,
      )}
    >
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      )}
      {children}
    </span>
  );
}
