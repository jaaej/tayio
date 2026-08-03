"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import {
  addTutorAvailabilityRule,
  removeTutorAvailabilityRule,
} from "@/app/admin/_lib/actions-availability";

const DAYS = [
  { code: 1, label: "Mon" },
  { code: 2, label: "Tue" },
  { code: 3, label: "Wed" },
  { code: 4, label: "Thu" },
  { code: 5, label: "Fri" },
  { code: 6, label: "Sat" },
  { code: 0, label: "Sun" },
];
const DAY_LABEL = new Map(DAYS.map((d) => [d.code, d.label]));

/** "09:00:00" | "09:00" -> "09:00". */
function hhmm(t: string): string {
  return t.slice(0, 5);
}

const INPUT =
  "h-9 rounded-[10px] border border-line bg-surface px-2.5 text-[13px] text-ink focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25";

type Slot = { weekday: number | null; startTime: string; endTime: string };

export function TutorAvailabilityEditor({
  tutorId,
  slots,
}: {
  tutorId: string;
  slots: Slot[];
}) {
  const [weekday, setWeekday] = useState(1);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sorted = [...slots]
    .filter((s): s is { weekday: number; startTime: string; endTime: string } =>
      s.weekday !== null,
    )
    .sort(
      (a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime),
    );

  function add() {
    setError(null);
    if (end <= start) {
      setError("End time must be after the start time.");
      return;
    }
    startTransition(async () => {
      try {
        await addTutorAvailabilityRule({
          tutorId,
          weekday,
          startTime: start,
          endTime: end,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't add the slot.");
      }
    });
  }

  function remove(s: { weekday: number; startTime: string; endTime: string }) {
    setError(null);
    startTransition(async () => {
      try {
        await removeTutorAvailabilityRule({
          tutorId,
          weekday: s.weekday,
          startTime: hhmm(s.startTime),
          endTime: hhmm(s.endTime),
        });
      } catch {
        setError("Couldn't remove the slot.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {sorted.length === 0 ? (
        <p className="text-[13px] text-muted">No recurring availability set.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {sorted.map((s, i) => (
            <span
              key={`${s.weekday}-${s.startTime}-${s.endTime}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-700"
            >
              {DAY_LABEL.get(s.weekday) ?? "?"} {hhmm(s.startTime)}–
              {hhmm(s.endTime)}
              <button
                type="button"
                onClick={() => remove(s)}
                disabled={pending}
                aria-label="Remove slot"
                className="text-brand-700/70 hover:text-bad disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1">
          <span className="block text-[11px] font-bold text-muted">Day</span>
          <select
            className={INPUT}
            value={weekday}
            onChange={(e) => setWeekday(Number(e.target.value))}
          >
            {DAYS.map((d) => (
              <option key={d.code} value={d.code}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-[11px] font-bold text-muted">From</span>
          <input
            type="time"
            className={INPUT}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="block text-[11px] font-bold text-muted">To</span>
          <input
            type="time"
            className={INPUT}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={add}
          disabled={pending}
          className="h-9 rounded-full bg-brand-600 px-4 text-[12px] font-bold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Add slot
        </button>
      </div>
      {error && <p className="text-[12px] font-semibold text-bad">{error}</p>}
    </div>
  );
}
