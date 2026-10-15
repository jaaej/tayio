"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AUTH_BUTTON, AuthError, AuthField } from "../_components/auth-fields";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    // Land back on /auth/callback (existing code-exchange route) with a
    // next= param so the user ends up on the set-new-password form, already
    // signed in via the recovery token.
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div role="status" className="rounded-[14px] border border-[#dce4f3] bg-[#f4f7fd] p-5 text-[15px] leading-relaxed text-[#2c4a86]">
        If an account exists for that email, a password-reset link has been
        sent. Check your inbox (and spam folder).
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
      <AuthField
        id="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {error && <AuthError>{error}</AuthError>}

      <button type="submit" disabled={loading} className={`${AUTH_BUTTON} mt-3`}>
        {loading ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
