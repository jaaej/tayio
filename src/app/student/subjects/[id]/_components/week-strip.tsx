"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export function WeekStrip({
  subjectId,
  currentTermId,
  termsAvailable,
  weeks,
  selectedWeekId,
  currentWeekIdHint,
}: {
  subjectId: string;
  currentTermId: string;
  termsAvailable: Array<{ id: string; year: number; termNumber: number }>;
  weeks: Array<{
    subjectWeekId: string;
    weekNumber: number;
    title: string;
    videoWatched: boolean;
    bookletOpened: boolean;
    homeworkTotal: number;
    homeworkDone: number;
  }>;
  selectedWeekId: string | null;
  currentWeekIdHint: string | null;
}) {
  const active = selectedWeekId ?? currentWeekIdHint ?? weeks[0]?.subjectWeekId;
  const base = `/student/subjects/${subjectId}`;

  return (
    <aside className="space-y-4">
      {/* Term selector */}
      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted mb-2">
          Term
        </div>
        <select
          defaultValue={currentTermId}
          onChange={(e) => {
            window.location.href = `${base}?term=${e.target.value}`;
          }}
          className="w-full rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm font-medium text-ink"
        >
          {termsAvailable.map((t) => (
            <option key={t.id} value={t.id}>
              {t.year} · Term {t.termNumber}
            </option>
          ))}
        </select>
      </div>

      {/* Week pills — vertical stack */}
      <div className="space-y-2.5">
        {weeks.map((w) => {
          const isActive = w.subjectWeekId === active;
          const isCurrent = w.subjectWeekId === currentWeekIdHint;
          const total = 2 + (w.homeworkTotal > 0 ? 1 : 0);
          const done =
            (w.videoWatched ? 1 : 0) +
            (w.bookletOpened ? 1 : 0) +
            (w.homeworkTotal > 0 && w.homeworkDone >= w.homeworkTotal ? 1 : 0);
          const complete = done === total && total > 0;

          return (
            <Link
              key={w.subjectWeekId}
              href={`${base}?term=${currentTermId}&week=${w.subjectWeekId}`}
              className={cn(
                "block rounded-2xl border-2 px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-16px_rgba(29,41,81,0.32)]",
                isActive
                  ? "border-brand-600 bg-gradient-to-br from-brand-200 via-brand-100 to-brand-50 shadow-[0_8px_24px_-12px_rgba(29,41,81,0.4)]"
                  : "border-hairline/60 bg-card hover:border-brand-300",
                !isActive && complete && "bg-emerald-50/40 border-emerald-300",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div
                  className={cn(
                    "text-[10px] uppercase tracking-[0.18em] font-semibold",
                    isActive ? "text-brand-700" : "text-muted",
                  )}
                >
                  Week {w.weekNumber}
                </div>
                {isCurrent && !isActive && (
                  <span className="text-[9px] uppercase tracking-wide text-brand-700 font-semibold">
                    Now
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm font-medium leading-tight text-ink line-clamp-2">
                {w.title}
              </div>
              <div className="mt-2.5 flex items-center gap-1 text-[10px]">
                <Marker on={w.videoWatched} label="V" title="Video watched" />
                <Marker
                  on={w.bookletOpened}
                  label="B"
                  title="Booklet opened"
                />
                {w.homeworkTotal > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 tabular-nums",
                      w.homeworkDone >= w.homeworkTotal
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800",
                    )}
                    title="Homework done / total"
                  >
                    {w.homeworkDone}/{w.homeworkTotal}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

function Marker({
  on,
  label,
  title,
}: {
  on: boolean;
  label: string;
  title: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold",
        on ? "bg-emerald-500 text-white" : "bg-hairline/40 text-muted",
      )}
    >
      {on ? "✓" : label}
    </span>
  );
}
