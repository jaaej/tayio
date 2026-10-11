"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { withListQuery } from "../_lib/directory-list";
import { MoreHorizontal, TriangleAlert } from "lucide-react";
import {
  hardDeleteUser,
  sendPasswordReset,
  setUserActive,
} from "@/app/admin/_lib/actions-users";
import { Button, SidePanel } from "@/components/admin/ui";
import { Input, Label } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";

/**
 * The profile header's "More actions" menu: password reset, deactivate or
 * reactivate, and (owner only, deactivated accounts only) permanent delete.
 */
export function UserAccountActions({
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
  const searchParams = useSearchParams();
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
    // The profile no longer exists: land on the list the admin came from.
    router.replace(withListQuery("/admin/users", searchParams));
    router.refresh();
  }

  return (
    <div className="inline-flex items-center">
      {canManageAccount && (
        <details ref={menuRef} className="group relative">
          <summary
            aria-label={`Account actions for ${name}`}
            title="Account actions"
            className="grid h-[38px] w-[38px] cursor-pointer list-none place-items-center rounded-[11px] border border-white/95 bg-white/65 text-ink transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 [&::-webkit-details-marker]:hidden"
          >
            <MoreHorizontal className="h-[18px] w-[18px]" aria-hidden />
            <span className="sr-only">Account actions</span>
          </summary>
          <div className="absolute right-0 top-full z-30 mt-1.5 w-52 overflow-hidden rounded-[10px] border border-line bg-surface p-1.5 text-left shadow-lg">
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
