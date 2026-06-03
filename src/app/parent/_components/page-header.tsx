import type { ReactNode } from "react";

/**
 * Shared parent page header in the Taiyo reference idiom: a wide-tracked
 * uppercase eyebrow over an extrabold, tightly-tracked (non-uppercase)
 * title, with an optional right-hand slot. Replaces the per-page local
 * `Header` helpers so every parent page shares one heading treatment.
 */
export function PageHeader({
  eyebrow,
  title,
  sub,
  right,
  pulse = false,
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: string;
  right?: ReactNode;
  pulse?: boolean;
}) {
  return (
    <header className="flex items-end justify-between gap-6 rise">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-bold text-muted">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full bg-brand-500${
              pulse ? " animate-pulse" : ""
            }`}
          />
          {eyebrow}
        </div>
        <h1 className="mt-2 text-3xl lg:text-4xl font-extrabold tracking-[-0.02em] text-ink">
          {title}
        </h1>
        {sub && <p className="mt-1.5 text-sm text-muted">{sub}</p>}
      </div>
      {right && <div className="shrink-0 hidden md:block">{right}</div>}
    </header>
  );
}
