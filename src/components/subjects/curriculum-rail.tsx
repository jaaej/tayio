"use client";

import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
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
}) {
  const active = selectedWeekId ?? currentWeekIdHint ?? weeks[0]?.id ?? null;

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
    // One major RECTANGULAR (square-cornered) block. The weeks sit inside it as
    // rounded sub-cards; the tinted panel makes the sub-cards read as distinct.
    <div className="space-y-2 border border-line bg-surface-2 p-2 shadow-[0_1px_2px_rgba(15,17,30,0.04),0_14px_30px_-18px_rgba(31,40,90,0.24)]">
      {showTermSelect && terms.length > 0 && (
        <div className="relative">
          <select
            defaultValue={currentTermId}
            onChange={(e) => {
              window.location.href = `${basePath}?${qs({ term: e.target.value })}`;
            }}
            aria-label="Select term"
            className="w-full appearance-none rounded-[10px] border border-line bg-surface pl-3 pr-8 py-2 text-[12px] font-bold text-ink cursor-pointer shadow-[0_1px_2px_rgba(15,17,30,0.05)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          >
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted"
          />
        </div>
      )}

      <div className="space-y-1">
        {groups.map((g) => (
          <div key={g.items[0].topicId ?? g.label}>
            {showHeadings && (
              <div className="px-2.5 pt-2 pb-1 text-[10px] uppercase tracking-[0.14em] font-extrabold text-muted">
                {g.label}
              </div>
            )}
            <div className="space-y-1.5">
              {g.items.map((w) => {
                const isActive = w.id === active;
                const isCurrent = w.id === currentWeekIdHint;
                return (
                  <Link
                    key={w.id}
                    href={`${basePath}?${qs({ term: currentTermId, week: w.id })}`}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "block rounded-[12px] border px-3 py-2.5 transition-colors",
                      isActive
                        ? "border-ink bg-ink text-white"
                        : "border-line bg-surface hover:border-line-strong",
                    )}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className={cn(
                          "text-[10px] uppercase tracking-[0.12em] font-extrabold",
                          isActive ? "text-white/80" : "text-muted",
                        )}
                      >
                        Week {w.weekNumber}
                      </span>
                      <span className="flex items-center gap-1">
                        {isCurrent && !isActive && (
                          <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.1em] text-white">
                            Now
                          </span>
                        )}
                        {w.complete && !isActive && (
                          <Check className="h-3 w-3 text-good" strokeWidth={3} />
                        )}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "mt-0.5 text-[14px] font-bold leading-snug line-clamp-2",
                        isActive ? "text-white" : "text-ink",
                      )}
                    >
                      {w.title}
                    </div>
                    {w.pills && w.pills.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {w.pills.map((p, i) => (
                          <span
                            key={i}
                            className={cn(
                              "inline-flex items-center rounded-full px-1.5 py-0 text-[9px] font-bold tabular-nums",
                              isActive
                                ? "bg-white/20 text-white"
                                : p.tone === "good"
                                  ? "bg-good-bg text-good"
                                  : p.tone === "warn"
                                    ? "bg-warn-bg text-warn"
                                    : "bg-surface text-muted",
                            )}
                          >
                            {p.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {footer}
      </div>
    </div>
  );
}
