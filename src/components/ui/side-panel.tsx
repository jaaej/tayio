"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Exit is deliberately quicker than enter so dismissing feels immediate. */
const EXIT_MS = 140;

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Right-side slide-over for a focused sub-task (create / edit) that would
 * otherwise need its own page. Portals to `document.body` so no ancestor's
 * `overflow: hidden` or transform can clip it.
 *
 * The portal root re-applies `.theme-tutor`: the admin palette is scoped to
 * that class by `components/admin/shell.tsx`, so a panel rendered outside the
 * shell would silently fall back to the default (non-cornflower) brand tokens.
 */
export function SidePanel({
  open,
  onClose,
  title,
  sub,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  /** In the DOM - stays true through the exit transition. */
  const [mounted, setMounted] = useState(false);
  /** Slid in - drives the transform/opacity crossfade. */
  const [shown, setShown] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      setMounted(true);
      // One frame at translate-x-full before sliding in, or the browser has
      // nothing to transition from.
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // Focus the panel itself rather than the first field: it keeps the close
  // button in the forward tab order and avoids a mobile keyboard popping up.
  useEffect(() => {
    if (!mounted) return;
    panelRef.current?.focus();
    return () => {
      const trigger = triggerRef.current;
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mounted]);

  // Listens on the window rather than the panel: clicking any non-focusable
  // text inside the panel drops focus back to <body>, where a handler bound to
  // the panel would never see Escape or Tab again.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (!(active instanceof Node) || !panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  // The layout is inline, not utilities, and must stay that way: portalling to
  // <body> makes this root a direct child of <body>, where the UNLAYERED
  // `body > * { position: relative; z-index: 1 }` rule in globals.css (the dot
  // field's stacking fix) beats any Tailwind `@layer utilities` class no matter
  // its specificity. As `fixed inset-0 z-[90]` utilities the panel collapsed
  // into normal flow at the foot of the page and rendered nothing visible; as
  // an inline style it outranks the unlayered rule. `background: transparent`
  // is here for the same reason - the full-screen root must not paint.
  // z-index 90 sits below ConfirmDialog's z-[100]: a confirmation raised from
  // inside the panel is the higher-priority interruption and must cover it.
  return createPortal(
    <div
      className="theme-tutor"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "transparent",
      }}
    >
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/50 transition-opacity duration-200 ease-out motion-reduce:transition-none",
          shown ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "absolute inset-y-0 right-0 flex w-full flex-col bg-surface outline-none sm:w-[440px]",
          "shadow-[0_24px_60px_-20px_rgba(31,40,90,0.45)]",
          "motion-reduce:transition-none",
          shown
            ? "translate-x-0 transition-transform duration-200 ease-out"
            : "translate-x-full transition-transform duration-[140ms] ease-in",
        )}
      >
        <div className="flex shrink-0 items-start gap-2 border-b border-line-strong bg-surface-2 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-[15px] font-extrabold tracking-[-0.01em] text-ink"
            >
              {title}
            </h2>
            {sub && <p className="mt-1 text-[12px] text-muted">{sub}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-my-1.5 -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-muted transition-colors hover:bg-surface-3 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X className="h-[18px] w-[18px]" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line-strong bg-surface p-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
