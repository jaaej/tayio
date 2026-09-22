"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Settings, TriangleAlert } from "lucide-react";
import {
  hardDeleteUser,
  sendPasswordReset,
  setUserActive,
} from "@/app/admin/_lib/actions-users";
import { Button, SidePanel } from "@/components/admin/ui";
import { Input, Label } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";

export function UserRowActions({
  id,
  email,
  isActive,
  name,
  canManageAccount,
  canHardDelete,
}: {
  id: string;
  email: string;
  isActive: boolean;
  name: string;
  canManageAccount: boolean;
  canHardDelete: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);

  function closeMenu() {
    menuRef.current?.removeAttribute("open");
  }

  function openHardDelete() {
    closeMenu();
    setConfirmationEmail("");
    setDeleteError(null);
    setDeleteOpen(true);
  }

  async function removePermanently() {
    setDeleteError(null);
    const result = await hardDeleteUser({ id, confirmationEmail });
    if (!result.ok) {
      setDeleteError(result.error);
      throw new Error(result.error);
    }
    setDeleteOpen(false);
    router.refresh();
  }

  return (
    <div className="inline-flex items-center gap-2 justify-end">
      <Link
        href={`/admin/users/${id}`}
        className="text-[11px] uppercase tracking-[0.14em] font-bold text-brand-600 hover:text-brand-700 transition-colors"
      >
        Open →
      </Link>
      {canManageAccount && (
        <details ref={menuRef} className="group relative">
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
            {!isActive && canHardDelete && (
              <button
                type="button"
                disabled={pending}
                onClick={openHardDelete}
                className="mt-1 flex min-h-10 w-full items-center rounded-[7px] border-t border-line px-3 pt-2 text-[12px] font-bold text-bad transition-colors hover:bg-bad-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-bad disabled:opacity-50"
              >
                Delete permanently
              </button>
            )}
          </div>
        </details>
      )}

      <SidePanel
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Permanently delete account"
        sub={name}
        footer={
          <>
            <Button
              type="button"
              size="lg"
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <LoadingButton
              onAction={removePermanently}
              variant="danger"
              disabled={
                confirmationEmail.trim().toLowerCase() !== email.toLowerCase()
              }
              pendingLabel="Deleting…"
              successLabel="Deleted"
              errorLabel="Try again"
            >
              Delete permanently
            </LoadingButton>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex gap-3 rounded-[12px] border border-bad/25 bg-bad-bg p-4 text-bad">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div>
              <p className="text-[13px] font-extrabold">This cannot be undone.</p>
              <p className="mt-1 text-[12px] leading-5">
                The login and linked personal records may be permanently erased.
                Accounts with protected financial, teaching, or administrative
                history will be refused instead of damaging those records.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor={`delete-confirm-${id}`} className="font-bold">
              Type {email} to confirm
            </Label>
            <Input
              id={`delete-confirm-${id}`}
              value={confirmationEmail}
              onChange={(event) => setConfirmationEmail(event.target.value)}
              placeholder={email}
              autoComplete="off"
              className="mt-2"
            />
          </div>

          {deleteError && (
            <p role="alert" className="text-[12px] font-semibold leading-5 text-bad">
              {deleteError}
            </p>
          )}
        </div>
      </SidePanel>
    </div>
  );
}
