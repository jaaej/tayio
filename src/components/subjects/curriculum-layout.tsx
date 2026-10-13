"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { subjectTone } from "@/lib/subject-tone";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "curriculum-weeks-open";

/**
 * Shared two-column shell for the curriculum page in every role: a weeks rail
 * on the left and the week content on the right. The rail is a glass bezel
 * (glass frame, white panel inside), so it follows each portal's theme tokens.
 *
 * `attached` (student, tutor, admin): on desktop the rail can collapse to a
 * slim "Weeks" tab. Opening PUSHES - the grid's column track animates, so the
 * content column shrinks as the rail grows (no overlay). The open/closed state
 * persists so it survives navigating between weeks. While the page scrolls the
 * rail stays pinned and runs to the bottom of the screen. On mobile the rail
 * becomes a "Choose a week" toggle above the content.
 *
 * `framed`: the page sits inside a padded shell with no top bar (the admin
 * glass shell). The rail pins at the shell's sticky offset and stops 20px
 * short of the bottom, matching the shell gutter. Without it (pages that bleed
 * to the edges of a top-bar shell) the rail column pins directly under the
 * top bar and runs the full remaining height, with the glass frame inset
 * inside it; the content column keeps the padding those pages' full-bleed
 * week heroes are measured against.
 *
 * Non-attached (rail lives inside a card - parent): a plain always-visible
 * rail column next to the content.
 *
 * `subjectName` (optional) puts the subject identity - colour dot plus name -
 * on the rail frame and the collapsed tab, so a page without its own header
 * still says which subject you are looking at.
 */
export function CurriculumLayout({
  rail,
  children,
  attached = false,
  framed = false,
  subjectName,
  defaultOpen = false,
}: {
  rail: React.ReactNode;
  children: React.ReactNode;
  attached?: boolean;
  framed?: boolean;
  subjectName?: string;
  /** Attached rail state before the viewer has opened or closed it. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setOpen(stored === "1");
    } catch {
      /* localStorage unavailable - keep the default */
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

  const dot = subjectName ? subjectTone(subjectName).dot : null;

  const subjectHeader = subjectName && (
    <div className="flex shrink-0 items-center gap-2 px-3 pb-1 pt-2">
      <span
        aria-hidden
        className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
        style={{ backgroundColor: dot ?? undefined }}
      />
      <span
        title={subjectName}
        className="truncate text-[14px] font-extrabold text-ink"
      >
        {subjectName}
      </span>
    </div>
  );

  // The glass frame around the rail: title row on the glass, list inside.
  const framedRail = (
    <div className="glass flex h-full min-h-0 flex-col rounded-[24px] p-1.5">
      {subjectHeader}
      {rail}
    </div>
  );

  const mobileRail = (
    // Edge-to-edge attached pages get the same 12px side inset as their
    // content column so the toggle never touches the screen edge.
    <div className={cn("lg:hidden", attached && !framed && "px-3 pt-3")}>
      <button
        type="button"
        onClick={() => setMobileOpen((current) => !current)}
        aria-expanded={mobileOpen}
        className="glass flex min-h-12 w-full items-center gap-2.5 rounded-[16px] px-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        {dot && (
          <span
            aria-hidden
            className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
            style={{ backgroundColor: dot }}
          />
        )}
        <span className="min-w-0 flex-1">
          {subjectName && (
            <span className="block truncate text-[14px] font-extrabold text-ink">
              {subjectName}
            </span>
          )}
          <span className="block text-[12px] font-semibold text-ink-soft">
            {mobileOpen ? "Hide weeks" : "Choose a week"}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-ink-soft transition-transform",
            mobileOpen && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {mobileOpen && (
        <div className="glass mt-2 flex flex-col rounded-[24px] p-1.5">{rail}</div>
      )}
    </div>
  );

  if (!attached) {
    return (
      <div className="flex-1 grid grid-cols-1 items-start gap-3 px-3 py-3 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-4">
        {mobileRail}
        <div className="hidden lg:sticky lg:top-[var(--portal-sticky-top)] lg:flex lg:max-h-[calc(100vh-var(--portal-sticky-top)-20px)] lg:flex-col lg:self-start">
          {framedRail}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex-1 grid grid-cols-1 items-start gap-3",
        framed ? "lg:gap-5" : "lg:gap-4",
        "lg:transition-[grid-template-columns] lg:duration-300 lg:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:lg:transition-none",
        // Tracks = rail width (260 open, 48 closed) plus the unframed inset.
        framed
          ? open
            ? "lg:grid-cols-[260px_minmax(0,1fr)]"
            : "lg:grid-cols-[48px_minmax(0,1fr)]"
          : open
            ? "lg:grid-cols-[272px_minmax(0,1fr)]"
            : "lg:grid-cols-[60px_minmax(0,1fr)]",
      )}
    >
      {/* self-stretch gives the sticky rail room to travel; without it the
          column is exactly one viewport tall and sticky never engages. */}
      <div className="lg:relative lg:self-stretch">
        {/* Stays pinned while the page scrolls and always reaches the bottom
            of the screen: under the top bar for the full remaining height,
            or (framed) at the shell's sticky offset down to its gutter. */}
        <div
          className={cn(
            "hidden lg:sticky lg:z-20 lg:block",
            framed
              ? "lg:top-[var(--portal-sticky-top)] lg:h-[calc(100vh-var(--portal-sticky-top)-20px)]"
              : "lg:top-[var(--portal-header-h)] lg:h-[calc(100vh-var(--portal-header-h))] lg:py-3 lg:pl-3",
          )}
        >
          <div className="relative h-full">
            {/* Full rail - clipped while closed; revealed when open. */}
            <div className="h-full overflow-hidden rounded-[24px]">
              <div
                // opacity-0 alone leaves the hidden week links in the tab order.
                inert={!open}
                className={cn(
                  "h-full w-[260px] transition-opacity duration-200",
                  open ? "opacity-100" : "pointer-events-none opacity-0",
                )}
              >
                {framedRail}
              </div>
            </div>

            {/* Closed: the "Weeks" tab - click to open. */}
            {!open && (
              <button
                type="button"
                onClick={toggle}
                aria-label="Show weeks"
                aria-expanded={false}
                className="glass absolute inset-y-0 left-0 flex w-[48px] flex-col items-center gap-2.5 rounded-[18px] pb-4 pt-3.5 text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
              >
                {dot && (
                  <span
                    aria-hidden
                    className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
                    style={{ backgroundColor: dot }}
                  />
                )}
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                {subjectName && (
                  // Long names would run off the strip - truncate down the
                  // vertical inline axis and keep the full name on hover.
                  <span
                    aria-hidden
                    title={subjectName}
                    className="min-h-0 flex-1 truncate text-[12px] font-extrabold [writing-mode:vertical-rl]"
                  >
                    {subjectName}
                  </span>
                )}
                <span
                  aria-hidden
                  className={cn(
                    "shrink-0 text-[11px] font-bold text-ink-soft [writing-mode:vertical-rl]",
                    !subjectName && "mt-1",
                  )}
                >
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
                className="absolute -right-3.5 top-3 z-40 grid h-7 w-7 place-items-center rounded-full border border-line-strong bg-surface text-ink-soft shadow-[0_2px_6px_-1px_rgba(15,17,30,0.2)] transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        </div>
        {/* Mobile: the rail as a toggle, stacked above the content. */}
        {mobileRail}
      </div>
      {/* No top padding on the content column: unframed pages' week heroes
          bleed to its top and right edges with negative margins. */}
      <div className={cn("min-w-0", !framed && "px-3 pb-3 lg:pl-0 lg:pr-4")}>
        {children}
      </div>
    </div>
  );
}
