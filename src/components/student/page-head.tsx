import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * PageHead - top-of-page header in the v2 design.
 * Eyebrow (optional uppercase tag) above an H1, with optional sub line
 * and right-aligned action slot.
 *
 * Secondary text here is --ink-soft, not --muted: the header sits straight on
 * the page wash (see the gradient in globals.css), where --muted bottoms out
 * around 1.9:1. --ink-soft holds 5.1:1 against the darkest end of the wash.
 */
export function PageHead({
  eyebrow,
  title,
  sub,
  actions,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-4 mb-5",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[11px] uppercase tracking-[0.16em] text-ink-soft font-bold mb-1.5">
            {eyebrow}
          </div>
        )}
        <h1 className="m-0 text-[24px] lg:text-[28px] font-extrabold tracking-[-0.01em] text-ink leading-tight">
          {title}
        </h1>
        {sub && (
          <div className="mt-1.5 text-[13px] text-ink-soft">{sub}</div>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </header>
  );
}

/**
 * SectionHead - block heading above a card or grid of cards.
 * H3 + optional action link on the right.
 */
export function SectionHead({
  title,
  actionHref,
  actionLabel,
  className,
}: {
  title: ReactNode;
  actionHref?: string;
  actionLabel?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between mb-3 px-0.5", className)}>
      <h3 className="m-0 text-[17px] font-extrabold tracking-[-0.01em] text-ink">
        {title}
      </h3>
      {actionHref && actionLabel && (
        <a
          href={actionHref}
          className="text-[12px] font-bold text-brand-ink hover:text-ink"
        >
          {actionLabel}
        </a>
      )}
    </div>
  );
}
