"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as a destructive (red) action. */
  danger?: boolean;
  /** What the action removes, listed under the body. */
  items?: string[];
  /** Text the user must type (e.g. a class name) before confirming. */
  confirmText?: string;
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
 * The dialog portals to `document.body`, above side panels (z-index 90) and
 * clear of any transformed ancestor, and carries the theme classes of the
 * place it was raised from, so it keeps the role's palette. Escape or
 * backdrop click cancels.
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
  const [typed, setTyped] = useState("");
  const typeId = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [theme, setTheme] = useState<string | null>(null);
  useLayoutEffect(() => {
    const host = anchorRef.current?.closest('[class*="theme-"]');
    setTheme(
      host ? [...host.classList].filter((c) => c.startsWith("theme-")).join(" ") : "",
    );
  }, []);
  const ready = !opts.confirmText || typed.trim() === opts.confirmText.trim();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter" && ready) onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm, ready]);

  const dialog = (
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
        {opts.items && opts.items.length > 0 && (
          <ul className="mt-2.5 list-disc space-y-1 pl-5 text-[13px] font-semibold text-ink">
            {opts.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        {opts.confirmText && (
          <div className="mt-4 flex flex-col gap-1.5">
            <label htmlFor={typeId} className="text-[13px] text-ink-soft">
              Type <strong className="font-bold text-ink">{opts.confirmText}</strong> to confirm
            </label>
            <input
              id={typeId}
              autoFocus
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="h-11 w-full rounded-[12px] border border-line-field bg-surface px-3.5 text-[15px] text-ink focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10"
            />
          </div>
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
            autoFocus={!opts.confirmText}
            disabled={!ready}
            onClick={onConfirm}
            className={cn(
              "h-9 rounded-full px-4 text-[13px] font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-45",
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

  return (
    <>
      <span ref={anchorRef} hidden />
      {theme !== null &&
        createPortal(
          // Inline layout beats the `body > *` stacking rule in globals.css;
          // the transparent background stops a theme class from painting.
          <div
            className={theme}
            style={{ position: "fixed", inset: 0, zIndex: 100, background: "transparent" }}
          >
            {dialog}
          </div>,
          document.body,
        )}
    </>
  );
}
