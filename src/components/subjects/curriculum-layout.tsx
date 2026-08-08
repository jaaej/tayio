"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "curriculum-weeks-open";

/**
 * Shared two-column shell for the curriculum page: a weeks rail on the left and
 * the week content on the right.
 *
 * `attached` (full-bleed pages like student): on desktop the rail is a "Weeks"
 * tab you CLICK to open. Opening PUSHES - the grid's column track animates, so
 * the content column shrinks as the rail grows and grows back when it closes
 * (no overlay). The open/closed state persists so it survives navigating
 * between weeks. On mobile the rail stacks above the content at full width.
 *
 * Non-attached (rail lives inside a card - parent/admin): a plain always-visible
 * rail column next to the content.
 */
export function CurriculumLayout({
  rail,
  children,
  attached = false,
}: {
  rail: React.ReactNode;
  children: React.ReactNode;
  attached?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* localStorage unavailable - stay closed */
    }
  }, []);

  const toggle = () =>
    setOpen((o) => {
      const next = !o;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  if (!attached) {
    return (
      <div className="flex-1 grid grid-cols-1 items-start gap-3 px-3 py-3 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-4">
        <div className="lg:sticky lg:top-2 lg:max-h-[calc(100vh-24px)] lg:self-start lg:overflow-y-auto">
          {rail}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex-1 grid grid-cols-1 items-start gap-3 lg:gap-4",
        "lg:transition-[grid-template-columns] lg:duration-300 lg:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:lg:transition-none",
        open
          ? "lg:grid-cols-[248px_minmax(0,1fr)]"
          : "lg:grid-cols-[34px_minmax(0,1fr)]",
      )}
    >
      <div className="lg:relative">
        <div className="hidden lg:sticky lg:top-0 lg:z-30 lg:block lg:h-[calc(100vh-56px)]">
          {/* Full rail - clipped while closed; revealed when open. */}
          <div className="h-full overflow-hidden">
            <div
              className={cn(
                "h-full w-[248px] overflow-y-auto transition-opacity duration-200",
                open ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              {rail}
            </div>
          </div>

          {/* Closed: the "Weeks" tab - click to open. */}
          {!open && (
            <button
              type="button"
              onClick={toggle}
              aria-label="Show weeks"
              aria-expanded={false}
              className="absolute inset-y-0 left-0 flex w-[34px] flex-col items-center gap-2 rounded-r-[14px] border border-l-0 border-line-strong bg-surface pt-5 text-ink shadow-[3px_0_16px_-5px_rgba(31,40,90,0.3)] transition-colors hover:bg-surface-2"
            >
              <ChevronRight className="h-4 w-4" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.28em] [writing-mode:vertical-rl]">
                Weeks
              </span>
            </button>
          )}

          {/* Open: a close handle on the rail's right edge (sits in the gap). */}
          {open && (
            <button
              type="button"
              onClick={toggle}
              aria-label="Hide weeks"
              aria-expanded
              className="absolute -right-3 top-3 z-40 inline-flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface text-muted shadow-[0_2px_6px_-1px_rgba(15,17,30,0.2)] transition-colors hover:text-ink"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {/* Mobile: full rail, stacked above the content. */}
        <div className="lg:hidden">{rail}</div>
      </div>
      <div className="min-w-0 pb-3 pr-3 pt-3 lg:pr-4">{children}</div>
    </div>
  );
}
