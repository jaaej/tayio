import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type StatTone =
  | "brand"
  | "mint"
  | "grape"
  | "sky"
  | "coral"
  | "sun"
  | "good"
  | "warn"
  | "bad";

const ICON_TINT: Record<StatTone, string> = {
  brand: "bg-brand-50 text-brand-500",
  mint: "bg-mint-bg text-mint",
  grape: "bg-grape-bg text-grape",
  sky: "bg-sky-bg text-sky",
  coral: "bg-coral-bg text-coral",
  sun: "bg-sun-100 text-sun-600",
  good: "bg-good-bg text-good",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad",
};

const ACCENT_BAR: Record<StatTone, string> = {
  brand: "bg-brand-500",
  mint: "bg-mint",
  grape: "bg-grape",
  sky: "bg-sky",
  coral: "bg-coral",
  sun: "bg-sun-500",
  good: "bg-good",
  warn: "bg-warn",
  bad: "bg-bad",
};

const DELTA_TONE = {
  up: "text-good",
  down: "text-bad",
  flat: "text-muted",
} as const;

/**
 * Student KPI tile. Visually identical to the parent/admin StatTile (tinted
 * icon square + optional top accent stripe + extrabold tabular value +
 * optional sub line + hover lift) so the "stat tile" feature reads the same
 * across every role. Status is carried by the icon/stripe `tone`, not by
 * colouring the number.
 */
export function StatTile({
  label,
  value,
  icon,
  tone = "brand",
  sub,
  subTone = "flat",
  href,
  accent,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  sub?: string;
  subTone?: keyof typeof DELTA_TONE;
  href?: string;
  /** Draw the matching top accent stripe. */
  accent?: boolean;
}) {
  const inner = (
    <div
      className={cn(
        "relative h-full bg-surface border border-line rounded-[14px] p-4 overflow-hidden",
        "shadow-[0_1px_2px_rgba(15,17,30,0.05),0_8px_24px_-12px_rgba(31,40,90,0.10)]",
        href &&
          "transition-all duration-150 hover:-translate-y-[3px] hover:shadow-[0_24px_50px_-22px_rgba(31,40,90,0.30)]",
      )}
    >
      {accent && (
        <span
          aria-hidden
          className={cn("absolute inset-x-0 top-0 h-1.5", ACCENT_BAR[tone])}
        />
      )}
      <div className="flex items-start gap-3">
        {icon && (
          <div
            className={cn(
              "h-[42px] w-[42px] rounded-[13px] grid place-items-center shrink-0",
              ICON_TINT[tone],
            )}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.08em] font-bold text-muted">
            {label}
          </div>
          <div className="text-[26px] leading-none font-extrabold tracking-[-0.02em] text-ink mt-1.5 tabular-nums">
            {value}
          </div>
          {sub && (
            <div
              className={cn(
                "text-[11px] font-semibold mt-1.5",
                DELTA_TONE[subTone],
              )}
            >
              {sub}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}
