"use client";

import { useTransition } from "react";
import { deleteClass } from "@/app/admin/_lib/actions-classes";

export function DeleteClassButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            `Delete "${name}"? Enrolments, lessons, and lesson notes attached to this class will be cascaded away. This cannot be undone.`,
          )
        )
          return;
        start(async () => {
          await deleteClass(id);
        });
      }}
      className="text-xs uppercase tracking-[0.14em] text-rose-700 hover:text-rose-900 disabled:opacity-50"
    >
      Delete
    </button>
  );
}
