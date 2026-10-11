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

/**
 * Solid white panel. In the glass redesign a panel normally sits inside a
 * GlassPanel frame; use Card on its own only inside an existing frame or
 * side panel.
 */
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
        "panel relative overflow-hidden",
        interactive &&
          "transition-all duration-150 hover:-translate-y-[2px] hover:shadow-[0_12px_30px_-16px_rgba(60,62,150,0.35)]",
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
        // Hairline rule, no tinted band: parent, student and tutor all head
        // their cards this way, and the grey band was the one thing making the
        // admin portal's cards read as a different, older component.
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
        <h3 className="text-[16px] font-extrabold text-ink truncate">
          {title}
        </h3>
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
