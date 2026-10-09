import type { ReactNode } from "react";

/**
 * Indigo gradient hero used at the top of a feature's landing page.
 *
 * Deliberately identical in every portal: the same feature must not read as a
 * different product depending on which role is signed in. Role-specific chrome
 * belongs in the page body, not here.
 */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned slot for the page's single primary action. */
  actions?: ReactNode;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-[22px] px-5 py-6 text-white shadow-[0_20px_44px_-22px_rgba(50,58,145,0.6)] sm:rounded-[28px] sm:px-8 sm:py-8"
      style={{
        background:
          "radial-gradient(120% 140% at 0% 0%, #A0BFFC 0%, transparent 45%), radial-gradient(110% 150% at 100% 10%, #7A9BF5 0%, transparent 52%), linear-gradient(125deg, #4F5BD5 0%, #3F4AB5 58%, #2B3287 100%)",
      }}
    >
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="absolute -right-8 -top-10 w-[220px] h-[220px] opacity-50 pointer-events-none"
        fill="none"
      >
        <circle cx="70" cy="30" r="30" fill="rgba(255,255,255,0.10)" />
        <circle cx="70" cy="30" r="20" fill="rgba(255,255,255,0.10)" />
        <circle cx="70" cy="30" r="10" fill="rgba(255,255,255,0.12)" />
      </svg>

      <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.2em] font-bold opacity-80">
            {eyebrow}
          </div>
          <h1 className="mt-2 text-[26px] font-bold tracking-[-0.02em] leading-tight sm:text-[32px] lg:text-[36px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 max-w-[480px] text-[15px] opacity-85">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">{actions}</div>
        )}
      </div>
    </section>
  );
}
