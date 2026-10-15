import type { ReactNode } from "react";
import Link from "next/link";
import { ToriiMark } from "@/components/brand/wordmark";
import { LoginWaves } from "./login-waves";
import { QuoteRotator } from "./quote-rotator";

/**
 * The sign-in family's page (sign in, forgot and reset password, sign up),
 * from the owner's mock: one rounded card, the form on white at the left,
 * the brand panel at the right (the torii, a rotating quote and drifting
 * waves). Below lg only the form side shows.
 */
export function AuthShell({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  /** A sentence the person needs (what the form does), when there is one. */
  intro?: ReactNode;
  /** The form; sign up has none. */
  children?: ReactNode;
  /** The row pinned to the bottom of the form side. */
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#ebeff8] px-4 py-6 sm:px-6 lg:px-10 lg:py-12">
      <main className="mx-auto grid w-full max-w-[1432px] flex-1 overflow-hidden rounded-[32px] bg-white shadow-[0_2px_4px_rgba(11,33,82,0.03),0_30px_80px_-30px_rgba(11,33,82,0.25)] lg:min-h-[760px] lg:grid-cols-[minmax(0,582fr)_minmax(0,850fr)]">
        <section className="flex flex-col px-7 py-9 sm:px-12 lg:px-[71px] lg:py-12">
          <Link
            href="/"
            className="inline-flex items-center gap-3 self-start rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c4a86]/40"
          >
            <ToriiMark width={44} />
            <span className="text-[14px] font-extrabold uppercase tracking-[0.14em] text-[#0b2152]">
              Taiyo Tuition
            </span>
          </Link>

          <div className="flex flex-1 flex-col justify-center py-12">
            <div className="w-full max-w-[440px]">
              <h1 className="text-[44px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[#0b2152] sm:text-[48px]">
                {title}
              </h1>
              {intro && <p className="mt-4 text-[15px] leading-relaxed text-[#5b6987]">{intro}</p>}
              {children && <div className="mt-10">{children}</div>}
            </div>
          </div>

          {footer && (
            <div className="flex max-w-[440px] flex-wrap items-center justify-between gap-3 text-[14px] text-[#5b6987]">
              {footer}
            </div>
          )}
        </section>

        <aside
          aria-label="Taiyo Tuition"
          className="relative hidden flex-col items-center overflow-hidden bg-[linear-gradient(170deg,#eff4fe_0%,#e3ecfe_45%,#d6e3fd_100%)] px-10 pt-[130px] lg:flex"
        >
          <ToriiMark width={225} />
          <div className="mt-12 w-full max-w-[600px]">
            <QuoteRotator />
          </div>
          <LoginWaves />
        </aside>
      </main>

      <p className="pt-6 text-center text-[13px] text-[#5b6987]">© Taiyo Tuition · Mount Waverley, VIC</p>
    </div>
  );
}
