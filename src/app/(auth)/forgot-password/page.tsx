import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { ForgotPasswordForm } from "./form";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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
            Reset password
          </div>
          <h1 className="text-4xl font-light text-ink tracking-tight">
            Forgot <span className="">password</span>.
          </h1>
          <p className="mt-3 text-sm text-ink-soft">
            Enter the email on your Taiyo account. We&apos;ll send you a link to
            set a new password.
          </p>

          <div className="mt-10">
            {error === "invalid_or_expired" ? (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                That password-reset link is invalid, expired, or has already
                been used. Request a new link below.
              </div>
            ) : null}
            <ForgotPasswordForm />
          </div>

          <p className="mt-8 text-xs text-ink-soft">
            Remembered it?{" "}
            <Link
              href="/login"
              className="text-brand-700 underline-offset-4 hover:underline"
            >
              Back to sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl w-full px-6 lg:px-10 py-8 text-[11px] text-ink-soft tracking-wide">
        © Taiyo Tuition
      </div>
    </div>
  );
}
