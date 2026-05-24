"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  sendPasswordReset,
  setUserActive,
} from "@/app/admin/_lib/actions-users";

export function UserRowActions({
  id,
  email,
  isActive,
  name,
}: {
  id: string;
  email: string;
  isActive: boolean;
  name: string;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="inline-flex items-center gap-2 justify-end">
      <Link
        href={`/admin/users/${id}`}
        className="text-xs uppercase tracking-[0.14em] text-brand-700 hover:text-brand-600"
      >
        Open →
      </Link>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Email a password reset link to ${email}?`)) return;
          start(async () => {
            await sendPasswordReset(email);
          });
        }}
      >
        Reset
      </Button>
      <Button
        size="sm"
        variant={isActive ? "outline" : "primary"}
        disabled={pending}
        onClick={() => {
          const verb = isActive ? "Deactivate" : "Reactivate";
          if (
            !confirm(
              `${verb} ${name}? ${
                isActive
                  ? "They will lose portal access until reactivated."
                  : "They will be able to log in again."
              }`,
            )
          )
            return;
          start(async () => {
            await setUserActive(id, !isActive);
          });
        }}
      >
        {isActive ? "Deactivate" : "Reactivate"}
      </Button>
    </div>
  );
}
