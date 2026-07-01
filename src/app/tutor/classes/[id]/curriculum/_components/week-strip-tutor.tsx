"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export function WeekStripTutor({
  classId,
  currentTermId,
  termsAvailable,
  weeks,
  selectedWeekId,
}: {
  classId: string;
  currentTermId: string;
  termsAvailable: Array<{ id: string; year: number; termNumber: number }>;
  weeks: Array<{
    subjectWeekId: string;
    weekNumber: number;
    title: string;
    hasSection: boolean;
    homeworkCount: number;
  }>;
  selectedWeekId: string | null;
}) {
  const active = selectedWeekId ?? weeks[0]?.subjectWeekId;
  const base = `/tutor/classes/${classId}/curriculum`;

  return (
    <aside className="space-y-4">
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

      <div className="space-y-2.5">
        {weeks.map((w) => {
          const isActive = w.subjectWeekId === active;
          return (
            <Link
              key={w.subjectWeekId}
              href={`${base}?term=${currentTermId}&week=${w.subjectWeekId}`}
              className={cn(
                "block rounded-2xl border-2 px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-16px_rgba(29,41,81,0.32)]",
                isActive
                  ? "border-brand-600 bg-gradient-to-br from-brand-200 via-brand-100 to-brand-50 shadow-[0_8px_24px_-12px_rgba(29,41,81,0.4)]"
                  : "border-hairline/60 bg-card hover:border-brand-300",
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
                {w.hasSection && (
                  <span className="text-[9px] uppercase tracking-wide text-amber-700 font-semibold">
                    Notes
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm font-medium leading-tight text-ink line-clamp-2">
                {w.title}
              </div>
              {w.homeworkCount > 0 && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-brand-700">
                  {w.homeworkCount} HW
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
