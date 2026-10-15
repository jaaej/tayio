"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AUTH_BUTTON, AuthError, AuthField, AuthPasswordField } from "../_components/auth-fields";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const search = useSearchParams();
  const next = search.get("next") ?? "";
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-[18px]">
      <input type="hidden" name="next" value={next} />
      <AuthField id="email" name="email" type="email" label="Email" autoComplete="email" required />
      <div className="flex flex-col gap-3">
        <AuthPasswordField
          id="password"
          name="password"
          label="Password"
          autoComplete="current-password"
          required
        />
        <Link
          href="/forgot-password"
          className="self-end rounded-[6px] text-[14px] font-extrabold text-[#2c4a86] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c4a86]/40"
        >
          Forgot password?
        </Link>
      </div>

      {state?.error && <AuthError>{state.error}</AuthError>}

      <button type="submit" disabled={isPending} className={`${AUTH_BUTTON} mt-3`}>
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
