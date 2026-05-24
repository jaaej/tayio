import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badge = cva(
  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-[0.12em]",
  {
    variants: {
      tone: {
        neutral: "bg-brand-100 text-ink-soft",
        brand: "bg-brand-200 text-navy-800",
        success: "bg-emerald-100 text-emerald-800",
        warn: "bg-amber-100 text-amber-800",
        danger: "bg-rose-100 text-rose-800",
        muted: "bg-brand-100/70 text-muted",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}
