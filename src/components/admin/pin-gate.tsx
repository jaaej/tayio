"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/admin/ui";
import { unlockAdmin } from "@/app/admin/_lib/actions-security";

export function AdminPinPrompt({
  pinSet,
  label = "Enter admin PIN to unlock",
}: {
  pinSet: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!pinSet) {
    return (
      <p className="text-[12px] text-muted">
        No admin PIN yet.{" "}
        <Link
          href="/admin/settings"
          className="font-semibold text-brand-700 hover:underline"
        >
          Set one in Settings
        </Link>{" "}
        to protect this action.
      </p>
    );
  }

  const submit = () => {
    setError(null);
    start(async () => {
      const res = await unlockAdmin(pin);
      if (!res.ok) setError(res.error);
      else {
        setPin("");
        router.refresh();
      }
    });
  };

  // Deliberately NOT a <form>: this renders inside the create/edit user forms,
  // and a nested <form> is invalid HTML (hydration error). Unlock on click/Enter.
  return (
    <div className="flex items-center gap-2">
      <Input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        placeholder={label}
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (!pending && pin.length >= 6) submit();
          }
        }}
        className="max-w-[220px]"
      />
      <Button
        type="button"
        variant="brand"
        size="sm"
        disabled={pending || pin.length < 6}
        onClick={submit}
      >
        {pending ? "Unlocking…" : "Unlock"}
      </Button>
      {error && <span className="text-[12px] font-semibold text-bad">{error}</span>}
    </div>
  );
}
