"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Vertical week rail — sits on the left of the subject page.
 * Themed with the subject's accent color: the rail's frame, the active
 * pill, and the hover state all use shades from getAccentTokens.
 */
export function WeekStrip({
  subjectId,
  currentTermId,
  termsAvailable,
  weeks,
  selectedWeekId,
  currentWeekIdHint,
  accent,
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
  /** Subject color tokens — drives the entire rail's theming. */
  accent: {
    bgFrom: string;
    bgTo: string;
    title: string;
    meta: string;
    arrow: string;
    ring: string;
    pillBg: string;
    pillText: string;
  };
}) {
  const active = selectedWeekId ?? currentWeekIdHint ?? weeks[0]?.subjectWeekId;
  const base = `/student/subjects/${subjectId}`;

  return (
    <aside
      className="rounded-[18px] border p-2 space-y-2 sticky top-2 self-start max-h-[calc(100vh-24px)] overflow-y-auto"
      style={{
        background: `linear-gradient(180deg, ${accent.bgFrom} 0%, ${accent.bgTo} 100%)`,
        borderColor: accent.ring,
      }}
    >
      {/* Term selector */}
      <select
        defaultValue={currentTermId}
        onChange={(e) => {
          window.location.href = `${base}?term=${e.target.value}`;
        }}
        className="w-full rounded-lg border bg-white/85 backdrop-blur px-2 py-1.5 text-[11px] font-bold focus:outline-none"
        style={{
          color: accent.title,
          borderColor: accent.ring,
        }}
      >
        {termsAvailable.map((t) => (
          <option key={t.id} value={t.id}>
            {t.year} · T{t.termNumber}
          </option>
        ))}
      </select>

      {/* Week list */}
      <div className="space-y-1">
        {weeks.map((w) => {
          const isActive = w.subjectWeekId === active;
          const isCurrent = w.subjectWeekId === currentWeekIdHint;
          const total = 2 + (w.homeworkTotal > 0 ? 1 : 0);
          const done =
            (w.videoWatched ? 1 : 0) +
            (w.bookletOpened ? 1 : 0) +
            (w.homeworkTotal > 0 && w.homeworkDone >= w.homeworkTotal ? 1 : 0);
          const complete = total > 0 && done === total;

          return (
            <Link
              key={w.subjectWeekId}
              href={`${base}?term=${currentTermId}&week=${w.subjectWeekId}`}
              className={cn(
                "block rounded-[12px] px-2.5 py-2 transition-all border",
                isActive
                  ? "text-white shadow-[0_8px_18px_-12px_rgba(31,40,90,0.35)]"
                  : "bg-white/75 backdrop-blur hover:bg-white/95",
              )}
              style={
                isActive
                  ? {
                      background: `linear-gradient(135deg, ${accent.arrow} 0%, ${accent.title} 100%)`,
                      borderColor: accent.arrow,
                    }
                  : {
                      borderColor: "transparent",
                    }
              }
            >
              <div className="flex items-center justify-between gap-1.5">
                <span
                  className={cn(
                    "text-[9px] uppercase tracking-[0.12em] font-extrabold",
                  )}
                  style={{
                    color: isActive ? "rgba(255,255,255,0.85)" : accent.meta,
                  }}
                >
                  Week {w.weekNumber}
                </span>
                {isCurrent && !isActive && (
                  <span
                    className="text-[8px] uppercase tracking-[0.1em] font-extrabold rounded-full px-1 py-0.5"
                    style={{
                      background: accent.arrow,
                      color: "#fff",
                    }}
                  >
                    Now
                  </span>
                )}
                {complete && !isActive && (
                  <Check
                    className="h-3 w-3"
                    strokeWidth={3}
                    style={{ color: accent.arrow }}
                  />
                )}
              </div>
              <div
                className={cn(
                  "mt-0.5 text-[12px] font-bold leading-tight line-clamp-2",
                )}
                style={{
                  color: isActive ? "#fff" : accent.title,
                }}
              >
                {w.title}
              </div>
              {w.homeworkTotal > 0 && (
                <div className="mt-1.5">
                  <span
                    className="inline-flex items-center rounded-full px-1.5 py-0 text-[9px] font-bold tabular-nums"
                    style={
                      isActive
                        ? {
                            background: "rgba(255,255,255,0.25)",
                            color: "#fff",
                          }
                        : w.homeworkDone >= w.homeworkTotal
                          ? {
                              background: "var(--good-bg)",
                              color: "var(--good)",
                            }
                          : {
                              background: "var(--warn-bg)",
                              color: "var(--warn)",
                            }
                    }
                  >
                    {w.homeworkDone}/{w.homeworkTotal}
                  </span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

