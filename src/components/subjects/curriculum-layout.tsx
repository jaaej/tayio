"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  colorFamilyForSubject,
  getAccentTokens,
} from "@/lib/subject-colors";
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
 *
 * `subjectName` (optional, attached mode only) makes the tab carry the subject
 * identity - coloured initial tile plus name - in BOTH states, so a page that
 * has no standalone header still says which subject you are looking at.
 */
export function CurriculumLayout({
  rail,
  children,
  attached = false,
  subjectName,
}: {
  rail: React.ReactNode;
  children: React.ReactNode;
  attached?: boolean;
  subjectName?: string;
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

  const subject = subjectName
    ? {
        name: subjectName,
        initial: subjectName.charAt(0).toUpperCase(),
        tokens: getAccentTokens(colorFamilyForSubject(subjectName)),
      }
    : null;

  // Sits directly on top of the rail block and shares its outline (same
  // line-strong weight, no bottom edge) so the two read as one white unit
  // divided by a hairline rather than two floating cards.
  const subjectHeader = subject && (
    <div className="flex shrink-0 items-center gap-2.5 border border-b-0 border-line-strong bg-surface px-2.5 py-2.5">
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-[15px] font-extrabold"
        style={{ background: subject.tokens.bgFrom, color: subject.tokens.arrow }}
      >
        {subject.initial}
      </span>
      <span
        title={subject.name}
        className="truncate text-[14px] font-extrabold tracking-[-0.01em]"
        style={{ color: subject.tokens.title }}
      >
        {subject.name}
      </span>
    </div>
  );

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
        // Closed track must match the closed tab's own w-[44px] below.
        open
          ? "lg:grid-cols-[248px_minmax(0,1fr)]"
          : "lg:grid-cols-[44px_minmax(0,1fr)]",
      )}
    >
      {/* self-stretch gives the sticky rail room to travel; without it the
          column is exactly one viewport tall and sticky never engages. */}
      <div className="lg:relative lg:self-stretch">
        <div className="hidden lg:sticky lg:top-0 lg:z-30 lg:block lg:h-[calc(100vh-56px)]">
          {/* Full rail - clipped while closed; revealed when open. */}
          <div className="h-full overflow-hidden">
            <div
              // opacity-0 alone leaves the hidden week links in the tab order.
              inert={!open}
              className={cn(
                "flex h-full w-[248px] flex-col transition-opacity duration-200",
                open ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              {subjectHeader}
              <div className="min-h-0 flex-1 overflow-y-auto">{rail}</div>
            </div>
          </div>

          {/* Closed: the "Weeks" tab - click to open. */}
          {!open && (
            <button
              type="button"
              onClick={toggle}
              aria-label="Show weeks"
              aria-expanded={false}
              // Square-cornered, like the rail it opens into - the two are the
              // same block in two states, so the closed tab keeps no rounding.
              className="absolute inset-y-0 left-0 flex w-[44px] flex-col items-center gap-2 border border-l-0 border-line-strong bg-surface pb-4 pt-3 text-ink shadow-[3px_0_16px_-5px_rgba(31,40,90,0.3)] transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400/50"
            >
              {subject ? (
                <>
                  <span
                    aria-hidden
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-[15px] font-extrabold"
                    style={{
                      background: subject.tokens.bgFrom,
                      color: subject.tokens.arrow,
                    }}
                  >
                    {subject.initial}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0" />
                  {/* Long names would run off the strip - truncate down the
                      vertical inline axis and keep the full name on hover. */}
                  <span
                    aria-hidden
                    title={subject.name}
                    className="min-h-0 flex-1 truncate text-[11px] font-bold [writing-mode:vertical-rl]"
                    style={{ color: subject.tokens.title }}
                  >
                    {subject.name}
                  </span>
                  <span
                    aria-hidden
                    className="shrink-0 text-[9px] font-extrabold uppercase tracking-[0.28em] text-muted [writing-mode:vertical-rl]"
                  >
                    Weeks
                  </span>
                </>
              ) : (
                <>
                  <ChevronRight className="mt-2 h-4 w-4 shrink-0" />
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.28em] [writing-mode:vertical-rl]">
                    Weeks
                  </span>
                </>
              )}
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
        <div className="lg:hidden">
          {subjectHeader}
          {rail}
        </div>
      </div>
      {/* No pt on the content column: the weeks tab beside it is anchored to
          the column top, so any top padding here left a square of page
          background above the tab. Both columns now start on the same edge. */}
      <div className="min-w-0 pb-3 pr-3 lg:pr-4">{children}</div>
    </div>
  );
}
