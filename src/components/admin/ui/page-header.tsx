import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small uppercase back link - the reference page back affordance.
 * --ink-soft rather than --muted: it sits on the page wash, where --muted
 * falls to ~1.9:1 at the dark end of the gradient.
 */
export function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] font-bold text-ink-soft hover:text-ink transition-colors"
    >
      <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
      {children}
    </Link>
  );
}

/**
 * Page header bar (glass redesign): a glass strip with the title on the left
 * and the page's actions on the right. `back` adds the square back button
 * used by detail pages. Keep `sub` for information the title does not already
 * carry (a date, a term); never restate the heading.
 */
export function PageHeader({
  eyebrow,
  title,
  sub,
  actions,
  back,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <header
      className={cn(
        "glass flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-[24px] py-3.5 pr-[18px]",
        back ? "pl-3.5" : "pl-[22px]",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        {back && (
          <Link
            href={back.href}
            aria-label={back.label}
            title={back.label}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-white/95 bg-white/65 text-ink transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <ChevronLeft className="h-[17px] w-[17px]" strokeWidth={2.4} aria-hidden />
          </Link>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          {eyebrow && (
            <div className="flex items-center gap-1.5 text-[13px] font-bold text-ink-soft">
              {eyebrow}
            </div>
          )}
          <h1 className="text-[22px] font-extrabold leading-tight text-ink">
            {title}
          </h1>
          {sub && (
            <p className="text-[13px] font-medium text-ink-soft">{sub}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
