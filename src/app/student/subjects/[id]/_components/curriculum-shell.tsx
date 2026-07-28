"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getAccentTokens } from "@/lib/subject-colors";
import { WeekRail, type WeekRailProps } from "./week-rail";

const PIN_STORAGE_KEY = "curriculum-rail-pinned";

export type CurriculumShellProps = {
  subjectId: string;
  currentTermId: string;
  termsAvailable: Array<{ id: string; year: number; termNumber: number }>;
  railItems: WeekRailProps["weeks"];
  /**
   * Every week's fully-rendered content, pre-rendered server-side (each is an
   * async Server Component instance - see note below on why this is nodes,
   * not raw data).
   */
  weekContents: Array<{ subjectWeekId: string; content: ReactNode }>;
  initialWeekId: string;
  currentWeekIdHint: string | null;
  accent: ReturnType<typeof getAccentTokens>;
};

/**
 * CurriculumShell - owns the active-week client state for the student
 * curriculum page, syncs it into the URL shallowly, cross-fades the switch,
 * and composes the WeekRail with the active week's content.
 *
 * Why `weekContents` is a list of pre-rendered nodes rather than raw
 * `StudentCurriculumWeek[]` passed down to a `<WeekContent/>` call in this
 * file: `WeekContent` is an async Server Component that calls
 * `signCurriculumUrl` (a Supabase server client using `next/headers`
 * cookies) directly. A Client Component (this file) cannot import and
 * instantiate a Server Component that touches server-only APIs - Next.js
 * fails the build ("You're importing a component that needs 'next/headers'
 * ... Client Components cannot import Server Components"). The sanctioned
 * fix is the standard Next.js composition pattern: the server parent
 * (`page.tsx`) pre-renders every week's `<WeekContent/>` once (still with
 * its unchanged `{ week, subjectName }` props) and hands the opaque,
 * already-rendered nodes down as data. This shell only ever *selects* which
 * pre-rendered node is visible - it never re-renders `WeekContent` itself,
 * so week switching stays instant and client-only exactly as intended.
 */
export function CurriculumShell({
  subjectId,
  currentTermId,
  termsAvailable,
  railItems,
  weekContents,
  initialWeekId,
  currentWeekIdHint,
  accent,
}: CurriculumShellProps) {
  const [activeWeekId, setActiveWeekId] = useState(initialWeekId);
  const [pinned, setPinned] = useState(false);
  const [entered, setEntered] = useState(false);

  // Pin preference is a browser affordance only - read after mount so SSR
  // output always matches the unpinned default (avoids a hydration mismatch).
  useEffect(() => {
    const stored = window.localStorage.getItem(PIN_STORAGE_KEY);
    if (stored === "true") setPinned(true);
  }, []);

  // Cross-fade the content swap. Reset opacity before paint (useLayoutEffect,
  // not useEffect) so the incoming week never flashes at full opacity first.
  useLayoutEffect(() => {
    setEntered(false);
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [activeWeekId]);

  function onSelectWeek(id: string) {
    setActiveWeekId(id);
    // Shallow URL sync only - no router.push/replace, which would re-run the
    // server component and turn this into a full navigation.
    window.history.replaceState(null, "", `?term=${currentTermId}&week=${id}`);
  }

  function onTogglePin() {
    setPinned((prev) => {
      const next = !prev;
      window.localStorage.setItem(PIN_STORAGE_KEY, String(next));
      return next;
    });
  }

  const active =
    weekContents.find((w) => w.subjectWeekId === activeWeekId) ??
    weekContents[0];

  return (
    <div
      className={cn(
        "flex-1 grid gap-3 lg:gap-4 px-3 lg:px-4 py-3 items-start",
        pinned
          ? "lg:grid-cols-[248px_minmax(0,1fr)]"
          : "lg:grid-cols-[56px_minmax(0,1fr)]",
      )}
    >
      <WeekRail
        subjectId={subjectId}
        currentTermId={currentTermId}
        termsAvailable={termsAvailable}
        weeks={railItems}
        activeWeekId={activeWeekId}
        currentWeekIdHint={currentWeekIdHint}
        onSelectWeek={onSelectWeek}
        pinned={pinned}
        onTogglePin={onTogglePin}
        accent={accent}
      />
      <div
        key={activeWeekId}
        className={cn(
          "min-w-0 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
          entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
        )}
      >
        {active?.content}
      </div>
    </div>
  );
}
