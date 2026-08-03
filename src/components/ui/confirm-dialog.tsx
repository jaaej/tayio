"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as a destructive (red) action. */
  danger?: boolean;
};

type Pending = { opts: ConfirmOptions; resolve: (ok: boolean) => void };

/**
 * Promise-based styled replacement for the native window.confirm().
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   if (!(await confirm({ title: "Delete?", danger: true }))) return;
 *   ...
 *   return <>{...}{confirmDialog}</>;   // render the dialog somewhere in the tree
 *
 * The dialog renders inside the caller's tree, so it inherits the role's theme
 * scope. Escape or backdrop click cancels.
 */
export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ opts, resolve })),
    [],
  );

  const settle = useCallback(
    (ok: boolean) => {
      setPending((p) => {
        p?.resolve(ok);
        return null;
      });
    },
    [],
  );

  const confirmDialog = pending ? (
    <ConfirmDialog
      opts={pending.opts}
      onCancel={() => settle(false)}
      onConfirm={() => settle(true)}
    />
  ) : null;

  return { confirm, confirmDialog };
}

function ConfirmDialog({
  opts,
  onCancel,
  onConfirm,
}: {
  opts: ConfirmOptions;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={opts.title}
    >
      <div
        className="absolute inset-0 bg-ink/50 backdrop-blur-[1px]"
        onClick={onCancel}
        aria-hidden
      />
      <div className="relative w-full max-w-sm rounded-[14px] border border-line bg-surface p-5 shadow-[0_24px_60px_-20px_rgba(15,17,30,0.45)]">
        <h2 className="text-[15px] font-extrabold text-ink">{opts.title}</h2>
        {opts.body && (
          <p className="mt-2 text-[13px] text-ink-soft whitespace-pre-wrap leading-snug">
            {opts.body}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-full border border-line bg-surface px-4 text-[13px] font-bold text-ink hover:bg-surface-2 transition-colors"
          >
            {opts.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className={cn(
              "h-9 rounded-full px-4 text-[13px] font-bold text-white transition-colors",
              opts.danger
                ? "bg-bad hover:brightness-95"
                : "bg-brand-600 hover:bg-brand-700",
            )}
          >
            {opts.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
