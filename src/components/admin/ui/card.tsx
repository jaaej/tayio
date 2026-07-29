import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Accent =
  | "brand"
  | "mint"
  | "grape"
  | "sky"
  | "coral"
  | "sun"
  | "good"
  | "warn"
  | "bad";

const ACCENT_BAR: Record<Accent, string> = {
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

/** Chunky white card on the cornflower wash - the reference `.card`. */
export function Card({
  accent,
  interactive,
  className,
  children,
}: {
  /** Optional top accent stripe. */
  accent?: Accent;
  /** Hover-lift + deeper shadow (for clickable cards). */
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative bg-surface border border-line rounded-[14px] overflow-hidden",
        "shadow-[0_1px_2px_rgba(15,17,30,0.05),0_8px_24px_-12px_rgba(31,40,90,0.10)]",
        interactive &&
          "transition-all duration-150 hover:-translate-y-[3px] hover:shadow-[0_24px_50px_-22px_rgba(31,40,90,0.30)]",
        className,
      )}
    >
      {accent && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 top-0 h-1.5 z-10",
            ACCENT_BAR[accent],
          )}
        />
      )}
      {children}
    </div>
  );
}

/** Card header row - `.card-head` (title + optional eyebrow + right action). */
export function CardHead({
  title,
  eyebrow,
  action,
  className,
}: {
  title: ReactNode;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-5 py-4 border-b border-line",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-muted-2">
            {eyebrow}
          </div>
        )}
        <h3 className="text-[14px] font-bold text-ink truncate">{title}</h3>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("p-5", className)}>{children}</div>;
}
