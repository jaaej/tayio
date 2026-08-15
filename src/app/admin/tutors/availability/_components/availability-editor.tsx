"use client";

import { useId, useState, useTransition } from "react";
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

/** Sentinel for the "any subject" scope, which is stored as subject_id NULL. */
const ANY = "any";

type Slot = {
  weekday: number | null;
  startTime: string;
  endTime: string;
  subjectId: string | null;
  subjectName: string | null;
};
type Subject = { id: string; name: string };

/**
 * Scopes offered in the switcher: "any subject" (where every pre-0040 slot
 * lives), every subject the tutor teaches, and any subject that still has
 * slots but is no longer taught - so dropping a class never orphans rows the
 * admin can no longer see or delete.
 */
function scopeOptions(subjects: Subject[], slots: Slot[]): Subject[] {
  const options = [{ id: ANY, name: "Any subject" }, ...subjects];
  const known = new Set(options.map((o) => o.id));
  for (const s of slots) {
    if (s.subjectId && !known.has(s.subjectId)) {
      known.add(s.subjectId);
      options.push({ id: s.subjectId, name: s.subjectName ?? "Other subject" });
    }
  }
  return options;
}

export function TutorAvailabilityEditor({
  tutorId,
  subjects,
  slots,
}: {
  tutorId: string;
  subjects: Subject[];
  slots: Slot[];
}) {
  const groupName = useId();
  const labelId = useId();
  const [scope, setScope] = useState<string>(ANY);
  const [weekday, setWeekday] = useState(1);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const subjectId = scope === ANY ? null : scope;
  const options = scopeOptions(subjects, slots);

  // Only the selected scope's slots: adding, removing and the list all act on
  // the subject the admin is currently looking at.
  const sorted = [...slots]
    .filter(
      (s): s is Slot & { weekday: number } =>
        s.weekday !== null && s.subjectId === subjectId,
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
          subjectId,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't add the slot.");
      }
    });
  }

  function remove(s: Slot & { weekday: number }) {
    setError(null);
    startTransition(async () => {
      try {
        await removeTutorAvailabilityRule({
          tutorId,
          weekday: s.weekday,
          startTime: hhmm(s.startTime),
          endTime: hhmm(s.endTime),
          subjectId: s.subjectId,
        });
      } catch {
        setError("Couldn't remove the slot.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {options.length === 1 ? (
        <p className="text-[13px] text-muted">
          No classes assigned yet, so these slots apply to any subject.
        </p>
      ) : (
        <div>
          <span
            id={labelId}
            className="block text-[11px] font-bold text-muted"
          >
            Subject
          </span>
          {/* Real radios behind the pills, so arrow-key navigation and
              screen-reader announcement come from the browser. Same shape as
              the class-type picker in admin/classes/_components. */}
          <div
            role="radiogroup"
            aria-labelledby={labelId}
            className="mt-1.5 flex flex-wrap gap-2"
          >
            {options.map((option) => {
              const active = scope === option.id;
              return (
                <label
                  key={option.id}
                  className={`inline-flex min-h-9 cursor-pointer items-center rounded-full border px-3.5 text-[12px] font-bold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 has-[:focus-visible]:ring-offset-1 ${
                    active
                      ? "border-brand-500 bg-brand-500 text-white"
                      : "border-line-strong bg-surface text-ink hover:border-brand-500 hover:text-brand-700"
                  }`}
                >
                  <input
                    type="radio"
                    name={groupName}
                    value={option.id}
                    checked={active}
                    onChange={() => setScope(option.id)}
                    className="sr-only"
                  />
                  {option.name}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-[13px] text-muted">No recurring availability set.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {sorted.map((s, i) => (
            <span
              key={`${s.weekday}-${s.startTime}-${s.endTime}-${i}`}
              className="inline-flex min-h-9 items-center gap-1 rounded-full bg-brand-50 pl-3 pr-1 text-[12px] font-semibold text-brand-700"
            >
              {DAY_LABEL.get(s.weekday) ?? "?"} {hhmm(s.startTime)}–
              {hhmm(s.endTime)}
              <button
                type="button"
                onClick={() => remove(s)}
                disabled={pending}
                aria-label={`Remove ${DAY_LABEL.get(s.weekday) ?? ""} ${hhmm(s.startTime)} to ${hhmm(s.endTime)}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-brand-700/70 hover:text-bad focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50"
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
          className="h-9 rounded-full bg-brand-600 px-4 text-[12px] font-bold text-white hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 disabled:opacity-60"
        >
          Add slot
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[12px] font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
