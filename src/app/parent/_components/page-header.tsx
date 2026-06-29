import type { ReactNode } from "react";

/**
 * Parent page header in the Taiyo reference idiom: an extrabold, tightly
 * tracked title over a muted subtitle, with an optional right-aligned
 * actions slot (buttons). Mirrors the reference `.page-head`.
 */
export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: ReactNode;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-5 flex-wrap rise">
      <div className="min-w-0">
        <h1 className="text-[28px] lg:text-[32px] font-extrabold tracking-[-0.02em] text-ink leading-[1.1]">
          {title}
        </h1>
        {sub && <p className="mt-1.5 text-sm text-muted max-w-2xl">{sub}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </header>
  );
}
