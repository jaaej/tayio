import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { SignupForm } from "./form";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col px-8 py-10 lg:px-16 lg:py-16">
      <Link href="/">
        <Wordmark />
      </Link>

      <div className="flex-1 flex items-center">
        <div className="w-full max-w-sm mx-auto">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted mb-3">
            Create account
          </div>
          <h1 className="text-4xl font-light text-ink tracking-tight">
            Get <span className="font-display italic">started</span>.
          </h1>
          <p className="mt-3 text-sm text-ink-soft">
            New accounts usually need approval from a Taiyo admin.
          </p>

          <div className="mt-10">
            <SignupForm />
          </div>

          <p className="mt-8 text-xs text-muted">
            Already have an account?{" "}
            <Link href="/login" className="text-brand-600 underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <p className="text-[11px] text-muted tracking-wide">© Taiyo Tuition</p>
    </div>
  );
}
