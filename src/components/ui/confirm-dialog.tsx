"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Lock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as a destructive (red) action. */
  danger?: boolean;
  /** Tile above the title: a bin for deletes, a lock for a blocked action. */
  icon?: "delete" | "lock";
  /** What the action is about, as a grey line with an optional colour dot. */
  subject?: { label: string; dot?: string };
  /** What the action removes, listed under the body. */
  items?: ReactNode[];
  /** Quiet extra fact under the list (e.g. "Invoices already issued are kept."). */
  note?: string;
  /** Red line before the buttons (e.g. "This can't be undone."). */
  warning?: string;
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
 * Drawn as the admin glass dialog (frame, white panel, icon tile). It portals
 * to `document.body`, above side panels (z-index 90) and clear of any
 * transformed ancestor, and carries the theme classes of the place it was
 * raised from, so it keeps the role's palette. Escape or backdrop click
 * cancels.
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

const BUTTON =
  "inline-flex h-[42px] items-center justify-center rounded-[12px] text-[14px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2";

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
  const titleId = useId();
  const bodyId = useId();
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
    // Capture phase, ahead of a side panel the dialog was raised from, so
    // Escape cancels the dialog without also closing the panel.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      if (e.key === "Enter" && ready) onConfirm();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel, onConfirm, ready]);

  const dialog = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[rgba(23,21,43,.34)] backdrop-blur-[3px]"
        onClick={onCancel}
        aria-hidden
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={opts.body ? bodyId : undefined}
        className="relative w-full max-w-[500px] rounded-[28px] border border-white/80 bg-white/55 p-1.5 shadow-[0_30px_80px_rgba(23,21,43,.30)] backdrop-blur-[28px] backdrop-saturate-[1.6]"
      >
        <div className="flex max-h-[calc(100dvh-3rem)] flex-col gap-4 overflow-y-auto rounded-[22px] bg-white p-6 shadow-[0_1px_2px_rgba(23,21,43,.06)]">
          {opts.icon && (
            <span
              aria-hidden
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-[14px]",
                opts.icon === "lock"
                  ? "bg-[#FDF1E0] text-[#B45309]"
                  : "bg-[#FDE8E8] text-[#B42318]",
              )}
            >
              {opts.icon === "lock" ? (
                <Lock className="h-5 w-5" strokeWidth={1.9} />
              ) : (
                <Trash2 className="h-5 w-5" strokeWidth={1.9} />
              )}
            </span>
          )}
          <h2 id={titleId} className="text-[20px] font-extrabold leading-tight text-ink">
            {opts.title}
          </h2>
          {opts.subject && (
            <span className="flex items-center gap-2 rounded-[12px] bg-[#F6F7FA] px-3 py-2.5 text-[14px] font-bold text-ink">
              {opts.subject.dot && (
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: opts.subject.dot }}
                />
              )}
              {opts.subject.label}
            </span>
          )}
          {opts.body && (
            <p id={bodyId} className="whitespace-pre-wrap text-[14px] leading-[1.55] text-[#2E2944]">
              {opts.body}
            </p>
          )}
          {opts.items && opts.items.length > 0 && (
            <ul className="flex list-disc flex-col gap-1.5 pl-[18px] text-[14px] leading-[1.45] text-[#2E2944]">
              {opts.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
          {opts.note && (
            <p className="text-[13px] leading-normal text-[#5E5A73]">{opts.note}</p>
          )}
          {opts.warning && (
            <p className="text-[13px] font-bold text-[#B42318]">{opts.warning}</p>
          )}
          {opts.confirmText && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={typeId} className="text-[13px] font-bold text-ink">
                Type <b>{opts.confirmText}</b> to confirm
              </label>
              <input
                id={typeId}
                autoFocus
                autoComplete="off"
                placeholder={opts.confirmText}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="h-11 w-full rounded-[12px] border border-[#DCDEE9] bg-white px-3 text-[15px] text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10"
              />
            </div>
          )}
          <div className="mt-1 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className={cn(BUTTON, "border border-[#DFE1EC] bg-white px-4 text-ink hover:bg-[#F5F6FA]")}
            >
              {opts.cancelLabel ?? "Cancel"}
            </button>
            <button
              type="button"
              autoFocus={!opts.confirmText}
              disabled={!ready}
              onClick={onConfirm}
              className={cn(
                BUTTON,
                "px-[18px] text-white disabled:cursor-not-allowed disabled:opacity-45",
                opts.danger ? "bg-[#B42318] hover:bg-[#9A1D14]" : "bg-ink hover:bg-[#2b2847]",
              )}
            >
              {opts.confirmLabel ?? "Confirm"}
            </button>
          </div>
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
