"use client";

import { useActionState, useEffect, useRef } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  changeMyPassword,
  type PasswordChangeState,
} from "../actions";

const initialState: PasswordChangeState = {};

export function PasswordChangeForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    changeMyPassword,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="max-w-xl space-y-4">
      <div className="flex gap-3 rounded-[12px] border border-brand-100 bg-brand-50 p-3.5 text-[12px] leading-5 text-ink-soft">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
        <p>
          Enter your current password to confirm it is you. Your new password
          must contain at least 8 characters.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={pending}
          />
        </div>
      </div>

      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-[10px] border px-3 py-2 text-[12px] font-semibold ${
            state.status === "success"
              ? "border-good/20 bg-good/10 text-good"
              : "border-bad/20 bg-bad/10 text-bad"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" variant="brand" disabled={pending}>
        {pending ? "Updating password…" : "Update password"}
      </Button>
    </form>
  );
}
