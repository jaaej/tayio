"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { coarseRole } from "@/lib/roles";
import type { UserRole } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

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
      <div className="rounded-xl border border-hairline/60 bg-brand-50 p-5 text-sm text-ink-soft">
        Password updated. Taking you to your dashboard…
      </div>
    );
  }

  if (sessionState === "checking") {
    return (
      <div role="status" className="py-6 text-center text-sm text-ink-soft">
        Checking your secure reset link…
      </div>
    );
  }

  if (sessionState === "missing") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          This password-reset link is invalid, expired, or was opened in a
          different browser session.
        </div>
        <Link
          href="/forgot-password"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-bold text-white transition-colors hover:bg-brand-700"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full" size="lg">
        {loading ? "Updating…" : "Set new password"}
      </Button>
    </form>
  );
}
