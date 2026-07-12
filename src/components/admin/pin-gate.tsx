"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
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

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await unlockAdmin(pin);
          if (!res.ok) setError(res.error);
          else {
            setPin("");
            router.refresh();
          }
        });
      }}
    >
      <Input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        placeholder={label}
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        className="max-w-[220px]"
      />
      <Button type="submit" variant="brand" size="sm" disabled={pending || pin.length < 4}>
        {pending ? "Unlocking…" : "Unlock"}
      </Button>
      {error && <span className="text-[12px] font-semibold text-bad">{error}</span>}
    </form>
  );
}

export function AdminPinGate({
  unlocked,
  pinSet,
  children,
}: {
  unlocked: boolean;
  pinSet: boolean;
  children: ReactNode;
}) {
  if (unlocked) return <>{children}</>;
  return <AdminPinPrompt pinSet={pinSet} />;
}
