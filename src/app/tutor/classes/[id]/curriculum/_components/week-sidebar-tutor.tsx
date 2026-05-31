"use client";

import Link from "next/link";

export function WeekSidebarTutor({
  classId,
  termsAvailable,
  currentTermId,
  weeks,
  selectedWeekId,
}: {
  classId: string;
  termsAvailable: Array<{ id: string; year: number; termNumber: number }>;
  currentTermId: string;
  weeks: Array<{
    subjectWeekId: string;
    weekNumber: number;
    title: string;
    hasOverride: boolean;
  }>;
  selectedWeekId: string | null;
}) {
  const base = `/tutor/classes/${classId}/curriculum`;

  return (
    <aside className="space-y-3">
      <label className="block text-xs uppercase tracking-wide text-muted">
        Term
      </label>
      <select
        defaultValue={currentTermId}
        onChange={(e) => {
          window.location.href = `${base}?term=${e.target.value}`;
        }}
        className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2 text-sm"
      >
        {termsAvailable.map((t) => (
          <option key={t.id} value={t.id}>
            {t.year} · Term {t.termNumber}
          </option>
        ))}
      </select>

      <nav className="space-y-1">
        {weeks.map((w) => {
          const isActive = w.subjectWeekId === selectedWeekId;
          return (
            <Link
              key={w.subjectWeekId}
              href={`${base}?term=${currentTermId}&week=${w.subjectWeekId}`}
              className={
                "rounded-md px-3 py-2 text-sm flex items-center justify-between gap-2 " +
                (isActive
                  ? "bg-brand-100 text-ink font-medium"
                  : "text-ink-soft hover:bg-brand-50")
              }
            >
              <span className="truncate">
                Week {w.weekNumber} · {w.title}
              </span>
              {w.hasOverride && (
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-amber-700">
                  override
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
