"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccentTokens } from "@/lib/subject-colors";

export function WeekStripTutor({
  classId,
  currentTermId,
  termsAvailable,
  weeks,
  selectedWeekId,
  accent,
}: {
  classId: string;
  currentTermId: string;
  termsAvailable: Array<{ id: string; year: number; termNumber: number }>;
  weeks: Array<{
    subjectWeekId: string;
    weekNumber: number;
    title: string;
    topicId: string | null;
    topicName: string | null;
    hasSection: boolean;
    homeworkCount: number;
  }>;
  selectedWeekId: string | null;
  accent: AccentTokens;
}) {
  const active = selectedWeekId ?? weeks[0]?.subjectWeekId;
  const base = `/tutor/classes/${classId}/curriculum`;

  // Group by topic in first-occurrence order (one bucket per unique topic).
  const groupMap = new Map<string, typeof weeks>();
  for (const w of weeks) {
    const label = w.topicName ?? "Other";
    if (!groupMap.has(label)) groupMap.set(label, []);
    groupMap.get(label)!.push(w);
  }
  const groups = [...groupMap.entries()].map(([label, items]) => ({ label, items }));
  const showHeadings = groups.length > 1;

  return (
    <aside
      className="rounded-[18px] border p-2 space-y-2 sticky top-2 self-start max-h-[calc(100vh-24px)] overflow-y-auto"
      style={{
        background: `linear-gradient(180deg, ${accent.bgFrom} 0%, ${accent.bgTo} 100%)`,
        borderColor: accent.ring,
      }}
    >
      {/* Term selector */}
      <div className="relative">
        <select
          defaultValue={currentTermId}
          onChange={(e) => {
            window.location.href = `${base}?term=${e.target.value}`;
          }}
          aria-label="Select term"
          className="w-full appearance-none rounded-[10px] border bg-white/90 backdrop-blur pl-3 pr-8 py-2 text-[12px] font-bold cursor-pointer shadow-[0_1px_2px_rgba(15,17,30,0.05)] focus:outline-none focus-visible:ring-2"
          style={{ color: accent.title, borderColor: accent.ring }}
        >
          {termsAvailable.map((t) => (
            <option key={t.id} value={t.id}>
              Term {t.termNumber} · {t.year}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4"
          style={{ color: accent.arrow }}
        />
      </div>

      {/* Week list - grouped by topic */}
      <div className="space-y-1">
        {groups.map((g) => (
          <div key={g.items[0].topicId ?? "other"}>
            {showHeadings && (
              <div
                className="px-2.5 pt-2 pb-1 text-[10px] uppercase tracking-[0.14em] font-extrabold"
                style={{ color: accent.meta }}
              >
                {g.label}
              </div>
            )}
            <div className="space-y-2">
              {g.items.map((w) => {
                const isActive = w.subjectWeekId === active;
                return (
                  <Link
                    key={w.subjectWeekId}
                    href={`${base}?term=${currentTermId}&week=${w.subjectWeekId}`}
                    className={cn(
                      "block rounded-[13px] px-3 py-2.5 transition-all border",
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
                        : { borderColor: "transparent" }
                    }
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className="text-[10px] uppercase tracking-[0.12em] font-extrabold"
                        style={{
                          color: isActive ? "rgba(255,255,255,0.85)" : accent.meta,
                        }}
                      >
                        Week {w.weekNumber}
                      </span>
                      {w.hasSection && (
                        <span
                          className="text-[8px] uppercase tracking-[0.1em] font-extrabold rounded-full px-1 py-0.5"
                          style={
                            isActive
                              ? { background: "rgba(255,255,255,0.25)", color: "#fff" }
                              : { background: accent.arrow, color: "#fff" }
                          }
                        >
                          Notes
                        </span>
                      )}
                    </div>
                    <div
                      className="mt-0.5 text-[14px] font-bold leading-snug line-clamp-2"
                      style={{ color: isActive ? "#fff" : accent.title }}
                    >
                      {w.title}
                    </div>
                    {w.homeworkCount > 0 && (
                      <div className="mt-1.5">
                        <span
                          className="inline-flex items-center rounded-full px-1.5 py-0 text-[9px] font-bold tabular-nums"
                          style={
                            isActive
                              ? { background: "rgba(255,255,255,0.25)", color: "#fff" }
                              : { background: accent.pillBg, color: accent.pillText }
                          }
                        >
                          {w.homeworkCount} HW
                        </span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
