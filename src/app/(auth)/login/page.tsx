import { Suspense } from "react";
import Link from "next/link";
import { Wordmark, LogoCard } from "@/components/brand/wordmark";
import { LoginForm } from "./form";

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — form */}
      <div className="flex flex-col px-8 py-10 lg:px-16 lg:py-16">
        <Link href="/">
          <Wordmark />
        </Link>

        <div className="flex-1 flex items-center">
          <div className="w-full max-w-sm mx-auto">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted mb-3">
              Sign in
            </div>
            <h1 className="text-4xl font-light text-ink tracking-tight">
              Welcome <span className="font-display italic">back</span>.
            </h1>
            <p className="mt-3 text-sm text-ink-soft">
              Use the email connected to your Taiyo Tuition account.
            </p>

            <div className="mt-10">
              <Suspense fallback={<div className="h-72" />}>
                <LoginForm />
              </Suspense>
            </div>

            <p className="mt-8 text-xs text-muted">
              First time here?{" "}
              <Link href="/signup" className="text-brand-600 underline-offset-4 hover:underline">
                Create an account
              </Link>
            </p>
          </div>
        </div>

        <p className="text-[11px] text-muted tracking-wide">
          © Taiyo Tuition · Mount Waverley, VIC
        </p>
      </div>

      {/* Right — editorial brand panel */}
      <div className="hidden lg:flex relative brand-field grain overflow-hidden">
        <div className="relative z-10 m-auto max-w-md text-center px-12">
          <LogoCard size={220} className="mx-auto mb-12" />
          <p className="font-display italic text-3xl text-ink leading-snug">
            "A quiet centre for the work that matters."
          </p>
          <p className="mt-6 text-[11px] uppercase tracking-[0.22em] text-white/70">
            taiyo · 太陽 · sun
          </p>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-white/20" />
      </div>
    </div>
  );
}
