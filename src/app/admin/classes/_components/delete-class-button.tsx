"use client";

import { useTransition } from "react";
import { deleteClass } from "@/app/admin/_lib/actions-classes";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function DeleteClassButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const { confirm, confirmDialog } = useConfirm();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (
            !(await confirm({
              title: `Delete "${name}"?`,
              body: "Enrolments, lessons, and lesson notes attached to this class will be cascaded away. This cannot be undone.",
              confirmLabel: "Delete class",
              danger: true,
            }))
          )
            return;
          start(async () => {
            await deleteClass(id);
          });
        }}
        className="text-[11px] uppercase tracking-[0.16em] font-bold text-bad hover:brightness-90 disabled:opacity-50"
      >
        Delete
      </button>
      {confirmDialog}
    </>
  );
}
