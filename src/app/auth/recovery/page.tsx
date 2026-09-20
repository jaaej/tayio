import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { confirmPasswordRecovery } from "./actions";

export const metadata: Metadata = {
  title: "Continue password reset | Taiyo Tuition",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PasswordRecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>;
}) {
  const { token_hash: tokenHash } = await searchParams;
  const hasToken = typeof tokenHash === "string" && tokenHash.length >= 20;

  return (
    <div className="min-h-screen brand-field grain flex flex-col">
      <div className="mx-auto max-w-6xl w-full px-6 lg:px-10 pt-8">
        <Link href="/">
          <Wordmark />
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 lg:px-10 py-12">
        <div className="bg-card rounded-3xl border border-hairline/40 shadow-[0_2px_4px_rgba(29,41,81,0.04),0_24px_60px_-24px_rgba(29,41,81,0.25)] px-8 py-10 lg:px-12 lg:py-14 w-full max-w-md">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted mb-3">
            Secure password reset
          </div>
          <h1 className="text-4xl font-light text-ink tracking-tight">
            Continue to reset your password.
          </h1>
          <p className="mt-3 text-sm text-ink-soft">
            Press continue to verify this one-time link and choose a new
            password. If you did not request this, you can safely close this
            page.
          </p>

          <div className="mt-8">
            {hasToken ? (
              <form action={confirmPasswordRecovery}>
                <input type="hidden" name="tokenHash" value={tokenHash} />
                <Button type="submit" className="w-full" size="lg">
                  Continue to reset password
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  This password-reset link is incomplete or no longer valid.
                </div>
                <Link
                  href="/forgot-password"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-bold text-white transition-colors hover:bg-brand-700"
                >
                  Request a new link
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl w-full px-6 lg:px-10 py-8 text-[11px] text-ink-soft tracking-wide">
        © Taiyo Tuition
      </div>
    </div>
  );
}
