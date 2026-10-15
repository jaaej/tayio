"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { coarseRole } from "@/lib/roles";
import type { UserRole } from "@/db/schema";
import { AUTH_BUTTON, AuthError, AuthPasswordField } from "../_components/auth-fields";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sessionState, setSessionState] = useState<
    "checking" | "ready" | "missing"
  >("checking");

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      setSessionState(!sessionError && data.session ? "ready" : "missing");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) setSessionState("ready");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(
        error.name === "AuthSessionMissingError"
          ? "This reset link is no longer valid. Request a new link and try again."
          : error.message,
      );
      return;
    }

    setDone(true);

    // Send them onward to their role home. The user's session is already
    // active from the recovery-token exchange in /auth/callback.
    const role =
      (data.user?.app_metadata?.role as UserRole | undefined) ??
      (data.user?.user_metadata?.role as UserRole | undefined);
    setTimeout(() => {
      router.push(role ? `/${coarseRole(role)}` : "/login");
      router.refresh();
    }, 1500);
  }

  if (done) {
    return (
      <div role="status" className="rounded-[14px] border border-[#dce4f3] bg-[#f4f7fd] p-5 text-[15px] leading-relaxed text-[#2c4a86]">
        Password updated. Taking you to your dashboard…
      </div>
    );
  }

  if (sessionState === "checking") {
    return (
      <div role="status" className="py-6 text-center text-[15px] text-[#5b6987]">
        Checking your secure reset link…
      </div>
    );
  }

  if (sessionState === "missing") {
    return (
      <div className="space-y-4">
        <AuthError>
          This password-reset link is invalid, expired, or was opened in a
          different browser session.
        </AuthError>
        <Link href="/forgot-password" className={AUTH_BUTTON}>
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
      <AuthPasswordField
        id="password"
        label="New password"
        autoComplete="new-password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <AuthPasswordField
        id="confirm"
        label="Confirm new password"
        autoComplete="new-password"
        required
        minLength={8}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />

      {error && <AuthError>{error}</AuthError>}

      <button type="submit" disabled={loading} className={`${AUTH_BUTTON} mt-3`}>
        {loading ? "Updating…" : "Set new password"}
      </button>
    </form>
  );
}
