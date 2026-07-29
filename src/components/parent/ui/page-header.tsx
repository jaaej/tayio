import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small uppercase back link - the reference page back affordance. */
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
      className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] font-bold text-muted hover:text-ink transition-colors"
    >
      <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
      {children}
    </Link>
  );
}

/** Page title strip - the reference `.page-head`. */
export function PageHeader({
  eyebrow,
  title,
  sub,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex items-end justify-between gap-4 flex-wrap",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-bold text-muted">
            {eyebrow}
          </div>
        )}
        <h1 className="mt-1 text-[26px] lg:text-[28px] font-extrabold tracking-[-0.01em] text-ink">
          {title}
        </h1>
        {sub && <p className="text-[13px] text-muted mt-1">{sub}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </header>
  );
}
