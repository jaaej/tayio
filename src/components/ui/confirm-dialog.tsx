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
  /**
   * One choice the action needs, as radio options under the body (e.g. this
   * lesson only, or this lesson and after). Use `choose`, which resolves
   * with the chosen value.
   */
  choices?: { legend: string; options: { value: string; label: string; detail?: string }[]; defaultValue: string };
};

type Pending = { opts: ConfirmOptions; resolve: (ok: boolean, choice: string | null) => void };

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
      new Promise<boolean>((resolve) => setPending({ opts, resolve: (ok) => resolve(ok) })),
    [],
  );

  /** Like `confirm` with `choices`: the chosen value, or null when cancelled. */
  const choose = useCallback(
    (opts: ConfirmOptions & { choices: NonNullable<ConfirmOptions["choices"]> }) =>
      new Promise<string | null>((resolve) =>
        setPending({ opts, resolve: (ok, choice) => resolve(ok ? choice : null) }),
      ),
    [],
  );

  const settle = useCallback(
    (ok: boolean, choice: string | null = null) => {
      setPending((p) => {
        p?.resolve(ok, choice);
        return null;
      });
    },
    [],
  );

  const confirmDialog = pending ? (
    <ConfirmDialog
      opts={pending.opts}
      onCancel={() => settle(false)}
      onConfirm={(choice) => settle(true, choice)}
    />
  ) : null;

  return { confirm, choose, confirmDialog };
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
  onConfirm: (choice: string | null) => void;
}) {
  const [typed, setTyped] = useState("");
  const [choice, setChoice] = useState<string | null>(opts.choices?.defaultValue ?? null);
  const choiceName = useId();
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
        e.stopPropagation();
        onCancel();
      }
      if (e.key === "Enter" && ready) onConfirm(choice);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel, onConfirm, ready, choice]);

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
          {opts.choices && (
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">{opts.choices.legend}</legend>
              {opts.choices.options.map((o) => (
                <label
                  key={o.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-[14px] border px-3.5 py-3 transition-colors",
                    choice === o.value ? "border-ink bg-[#F6F7FA]" : "border-[#DFE1EC] hover:bg-[#F8F9FC]",
                  )}
                >
                  <input
                    type="radio"
                    name={choiceName}
                    value={o.value}
                    checked={choice === o.value}
                    onChange={() => setChoice(o.value)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#17152B]"
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[14px] font-bold text-ink">{o.label}</span>
                    {o.detail && <span className="text-[13px] leading-snug text-[#5E5A73]">{o.detail}</span>}
                  </span>
                </label>
              ))}
            </fieldset>
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
              onClick={() => onConfirm(choice)}
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
          // Above side panels (90) and the file viewer (120), which raise
          // confirmations too.
          <div
            className={theme}
            style={{ position: "fixed", inset: 0, zIndex: 130, background: "transparent" }}
          >
            {dialog}
          </div>,
          document.body,
        )}
    </>
  );
}
