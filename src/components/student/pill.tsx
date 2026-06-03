import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Student-portal Pill (v2 design). Small semantic chip with optional dot.
 * Aliased as Badge for callsites that want that name.
 */
const pill = cva(
  "inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[11px] font-bold leading-none whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 text-ink-soft border border-line",
        brand:   "bg-brand-50 text-brand-700",
        good:    "bg-good-bg text-good",
        warn:    "bg-warn-bg text-warn",
        bad:     "bg-bad-bg text-bad",
        info:    "bg-info-bg text-info",
        muted:   "bg-surface-2 text-muted border border-line",
        success: "bg-good-bg text-good",
        danger:  "bg-bad-bg text-bad",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface PillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pill> {
  dot?: boolean;
}

export function Pill({ className, tone, dot, children, ...props }: PillProps) {
  return (
    <span className={cn(pill({ tone }), className)} {...props}>
      {dot && (
        <span aria-hidden className="w-[6px] h-[6px] rounded-full bg-current" />
      )}
      {children}
    </span>
  );
}

export const Badge = Pill;
