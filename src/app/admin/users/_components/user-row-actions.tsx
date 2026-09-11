"use client";

import Link from "next/link";
import { useRef, useTransition } from "react";
import { Settings } from "lucide-react";
import {
  sendPasswordReset,
  setUserActive,
} from "@/app/admin/_lib/actions-users";

export function UserRowActions({
  id,
  email,
  isActive,
  name,
  canManageAccount,
}: {
  id: string;
  email: string;
  isActive: boolean;
  name: string;
  canManageAccount: boolean;
}) {
  const [pending, start] = useTransition();
  const menuRef = useRef<HTMLDetailsElement>(null);

  function closeMenu() {
    menuRef.current?.removeAttribute("open");
  }

  return (
    <div className="inline-flex items-center gap-2 justify-end">
      <Link
        href={`/admin/users/${id}`}
        className="text-[11px] uppercase tracking-[0.14em] font-bold text-brand-600 hover:text-brand-700 transition-colors"
      >
        Open →
      </Link>
      {canManageAccount && <details ref={menuRef} className="group relative">
        <summary
          aria-label={`Account actions for ${name}`}
          title="Account actions"
          className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-[9px] border border-line-strong bg-surface text-muted transition-colors hover:border-brand-400 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 [&::-webkit-details-marker]:hidden"
        >
          <Settings className="h-4 w-4" aria-hidden />
          <span className="sr-only">Account actions</span>
        </summary>
        <div className="absolute right-0 top-full z-30 mt-1.5 w-44 overflow-hidden rounded-[10px] border border-line bg-surface p-1.5 text-left shadow-lg">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Email a password reset link to ${email}?`)) return;
              closeMenu();
              start(async () => {
                await sendPasswordReset(email);
              });
            }}
            className="flex min-h-10 w-full items-center rounded-[7px] px-3 text-[12px] font-bold text-ink transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            Send password reset
          </button>
          <button
            type="button"
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
              closeMenu();
              start(async () => {
                await setUserActive(id, !isActive);
              });
            }}
            className={
              isActive
                ? "flex min-h-10 w-full items-center rounded-[7px] px-3 text-[12px] font-bold text-bad transition-colors hover:bg-bad-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-bad disabled:opacity-50"
                : "flex min-h-10 w-full items-center rounded-[7px] px-3 text-[12px] font-bold text-good transition-colors hover:bg-good-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-good disabled:opacity-50"
            }
          >
            {isActive ? "Deactivate account" : "Reactivate account"}
          </button>
        </div>
      </details>}
    </div>
  );
}
