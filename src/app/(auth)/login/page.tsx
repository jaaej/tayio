import { Suspense } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { LoginForm } from "./form";

export default function LoginPage() {
  return (
    <div className="min-h-screen brand-field grain">
      <div className="mx-auto max-w-6xl px-6 lg:px-10 pt-8">
        <Link href="/">
          <Wordmark portalPlacement="inline" />
        </Link>
      </div>

      <div className="mx-auto max-w-6xl px-6 lg:px-10 py-12 lg:py-20 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center">
        {/* Form on a white card */}
        <div className="bg-card rounded-3xl border border-hairline/40 shadow-[0_2px_4px_rgba(29,41,81,0.04),0_24px_60px_-24px_rgba(29,41,81,0.25)] px-8 py-10 lg:px-12 lg:py-14">
          <div className="w-full max-w-sm mx-auto">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted mb-3">
              Sign in
            </div>
            <h1 className="text-4xl font-light text-ink tracking-tight">
              Welcome <span className="">back</span>.
            </h1>
            <p className="mt-3 text-sm text-ink-soft">
              Use the email connected to your Taiyo Tuition account.
            </p>

            <div className="mt-10">
              <Suspense fallback={<div className="h-72" />}>
                <LoginForm />
              </Suspense>
            </div>

            <p className="mt-6 text-xs text-ink-soft">
              <Link
                href="/forgot-password"
                className="text-brand-700 underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </p>
            <p className="mt-3 text-xs text-ink-soft">
              Need an account? Reach out to your Taiyo admin.
            </p>
          </div>
        </div>

        {/* Editorial artwork panel */}
        <div className="login-wave-stage hidden min-h-[570px] items-center justify-center overflow-hidden px-10 text-center lg:flex">
          <div className="login-wave-motion" aria-hidden="true">
            <img
              src="/brand/great-wave.jpeg"
              alt=""
              width={1200}
              height={807}
              draggable={false}
              className="login-wave-art"
            />
          </div>
          <p className="login-wave-quote text-3xl leading-snug text-ink">
            "Be That Cousin"
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 lg:px-10 py-8 text-[11px] text-ink-soft tracking-wide">
        © Taiyo Tuition · Mount Waverley, VIC
      </div>
    </div>
  );
}
