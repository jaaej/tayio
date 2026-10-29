"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, LockKeyhole } from "lucide-react";
import { MenuSelect } from "@/components/ui/menu-select";
import { startNavigationLoading } from "@/lib/navigation-loading";
import { cn } from "@/lib/utils";

/**
 * The shared "weeks tab" rail for the curriculum page - one implementation used
 * by every role (student, parent, tutor, admin) so the feature stays identical
 * across portals. Neutral by design: the only colour on the curriculum page
 * lives in the per-week hero head block, so this rail uses ink/surface/line
 * tokens plus semantic good/warn/brand accents only for status and wayfinding.
 *
 * Role differences are just data: pass a `basePath` + optional `extraParams`
 * (e.g. the parent portal's viewed-child id) and the component builds every
 * link itself. An optional `footer` slot carries the admin "+ Add week" action.
 */
export type RailWeek = {
  /** subjectWeekId (student/parent/tutor) or week.id (admin) */
  id: string;
  weekNumber: number;
  title: string;
  topicName: string | null;
  topicId: string | null;
  /** all tasks done - shows a check */
  complete?: boolean;
  /** small status pills (e.g. homework count, "Notes") */
  pills?: { label: string; tone?: "neutral" | "good" | "warn" }[];
  /** Learners can see that the week exists, but cannot open it before release. */
  locked?: boolean;
  /** Tooltip on a locked week, e.g. "Unlocks Mon 20 Oct". */
  lockedHint?: string;
};

export function CurriculumRail({
  basePath,
  extraParams,
  terms,
  currentTermId,
  weeks,
  selectedWeekId,
  currentWeekIdHint = null,
  footer,
  showTermSelect = true,
  accent,
}: {
  basePath: string;
  extraParams?: Record<string, string>;
  terms: { id: string; label: string }[];
  currentTermId: string;
  weeks: RailWeek[];
  selectedWeekId: string | null;
  currentWeekIdHint?: string | null;
  footer?: React.ReactNode;
  /** Term switcher at the top of the rail. Off for learner views. */
  showTermSelect?: boolean;
  /** Fill for the selected week instead of ink (a subject colour that
   *  carries white text at 4.5:1). */
  accent?: string;
}) {
  const router = useRouter();
  const active =
    selectedWeekId ??
    currentWeekIdHint ??
    weeks.find((week) => !week.locked)?.id ??
    null;

  const qs = (extra: Record<string, string>) =>
    new URLSearchParams({ ...(extraParams ?? {}), ...extra }).toString();

  // Group by topic in first-occurrence order (one bucket per unique topic).
  const groupMap = new Map<string, RailWeek[]>();
  for (const w of weeks) {
    const label = w.topicName ?? "Other";
    if (!groupMap.has(label)) groupMap.set(label, []);
    groupMap.get(label)!.push(w);
  }
  const groups = [...groupMap.entries()].map(([label, items]) => ({
    label,
    items,
  }));
  const showHeadings = groups.length > 1;

  return (
    // Content of the glass rail frame (the frame itself comes from
    // CurriculumLayout): the term switcher sits on the glass, the weeks on a
    // white panel that fills the rest of the frame and scrolls on its own.
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      {showTermSelect && terms.length > 0 && (
        <div className="px-1.5 pt-1.5">
          <MenuSelect
            label="Term"
            value={currentTermId}
            options={terms.map((t) => ({ value: t.id, label: t.label }))}
            onChange={(termId) => {
              startNavigationLoading();
              router.push(`${basePath}?${qs({ term: termId })}`);
            }}
          />
        </div>
      )}

      <div className="panel relative flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2">
        {groups.map((g) => (
          <div key={g.items[0].topicId ?? g.label} className="flex flex-col gap-0.5">
            {showHeadings && (
              <div className="px-2 py-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted">
                {g.label}
              </div>
            )}
            {g.items.map((w) => {
              const isActive = w.id === active;
              const isCurrent = w.id === currentWeekIdHint;
              const content = (
                <>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-[26px] shrink-0 text-[12px] font-extrabold tabular-nums",
                        isActive ? "text-white/80" : "text-ink-soft",
                      )}
                    >
                      W{w.weekNumber}
                    </span>
                    <span
                      title={w.title}
                      className="min-w-0 flex-1 truncate text-[13px] font-bold"
                    >
                      {w.title}
                    </span>
                    {w.locked && (
                      <LockKeyhole
                        className="h-3.5 w-3.5 shrink-0 text-muted"
                        aria-label="Locked"
                      />
                    )}
                    {isCurrent && !isActive && (
                      <span className="shrink-0 rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                        Now
                      </span>
                    )}
                    {w.complete && !isActive && (
                      <Check
                        className="h-3.5 w-3.5 shrink-0 text-good"
                        strokeWidth={3}
                        aria-label="Done"
                      />
                    )}
                  </span>
                  {w.pills && w.pills.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1 pl-[34px]">
                      {w.pills.map((p, i) => (
                        <span
                          key={i}
                          className={cn(
                            "inline-flex h-[18px] items-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                            isActive
                              ? "bg-white/20 text-white"
                              : p.tone === "good"
                                ? "bg-good-bg text-good"
                                : p.tone === "warn"
                                  ? "bg-warn-bg text-warn"
                                  : "bg-surface-3 text-ink-soft",
                          )}
                        >
                          {p.label}
                        </span>
                      ))}
                    </span>
                  )}
                </>
              );

              if (w.locked) {
                return (
                  <div
                    key={w.id}
                    aria-disabled="true"
                    title={
                      w.lockedHint ??
                      `Week ${w.weekNumber} unlocks when that teaching week begins`
                    }
                    className="block cursor-not-allowed rounded-[10px] p-2 text-muted opacity-70"
                  >
                    {content}
                  </div>
                );
              }

              return (
                <Link
                  key={w.id}
                  href={`${basePath}?${qs({ term: currentTermId, week: w.id })}`}
                  aria-current={isActive ? "page" : undefined}
                  style={isActive && accent ? { backgroundColor: accent } : undefined}
                  className={cn(
                    "block rounded-[10px] p-2 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                    isActive
                      ? "bg-ink text-white"
                      : "text-ink hover:bg-surface-2",
                  )}
                >
                  {content}
                </Link>
              );
            })}
          </div>
        ))}
        {footer}
      </div>
    </div>
  );
}
