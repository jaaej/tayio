"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/admin/ui/button";
import { cn } from "@/lib/utils";
import {
  changeMyPassword,
  type PasswordChangeState,
} from "../actions";

const initialState: PasswordChangeState = {};

const FIELD =
  "h-[42px] w-full rounded-[11px] border border-[#DCDEE9] bg-surface px-3 text-[14px] font-medium text-ink outline-none transition-shadow focus:border-ink focus:ring-[3px] focus:ring-ink/10 disabled:opacity-60";

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
    <form ref={formRef} action={formAction} className="flex flex-col gap-3.5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-3">
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
          Current password
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
          New password
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={pending}
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
          Confirm new password
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={pending}
            className={FIELD}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {state.message ? (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={cn(
              "mr-auto text-[13px] font-semibold",
              state.status === "success" ? "text-good" : "text-bad",
            )}
          >
            {state.message}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Updating password…" : "Update password"}
        </Button>
      </div>
    </form>
  );
}
