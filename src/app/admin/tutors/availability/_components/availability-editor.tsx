"use client";

import { useId, useState, useTransition } from "react";
import { TimeSelect } from "@/components/ui/time-select";
import { X } from "lucide-react";
import {
  addTutorAvailabilityRule,
  removeTutorAvailabilityRule,
} from "@/app/admin/_lib/actions-availability";
import { Button } from "@/components/admin/ui";

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
  "h-[38px] rounded-[10px] border border-line-strong bg-surface px-2 text-[13px] font-medium text-ink focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25";
const LABEL = "flex flex-col gap-[5px] text-[12px] font-bold text-ink";

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
        const res = await addTutorAvailabilityRule({
          tutorId,
          weekday,
          startTime: start,
          endTime: end,
          subjectId,
        });
        if (!res.ok) setError(res.error);
      } catch {
        setError("Couldn't add the slot. Try again.");
      }
    });
  }

  function remove(s: Slot & { weekday: number }) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await removeTutorAvailabilityRule({
          tutorId,
          weekday: s.weekday,
          startTime: hhmm(s.startTime),
          endTime: hhmm(s.endTime),
          subjectId: s.subjectId,
        });
        if (!res.ok) setError(res.error);
      } catch {
        setError("Couldn't remove the slot.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3.5">
      {options.length === 1 ? (
        <p className="text-[13px] text-muted">
          No classes assigned yet, so these slots apply to any subject.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <span
            id={labelId}
            className="text-[12px] font-extrabold text-muted"
          >
            Subject
          </span>
          {/* Real radios behind the pills, so arrow-key navigation and
              screen-reader announcement come from the browser. Same shape as
              the class-type picker in admin/classes/_components. */}
          <div
            role="radiogroup"
            aria-labelledby={labelId}
            className="flex flex-wrap gap-1.5"
          >
            {options.map((option) => {
              const active = scope === option.id;
              return (
                <label
                  key={option.id}
                  className={`inline-flex min-h-9 cursor-pointer items-center rounded-full border px-3 text-[12px] font-bold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400 has-[:focus-visible]:ring-offset-1 ${
                    active
                      ? "border-ink bg-ink text-white"
                      : "border-line-strong bg-surface text-ink-soft hover:bg-surface-2 hover:text-ink"
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
              className="inline-flex h-[38px] items-center gap-0.5 rounded-[10px] border border-line-strong bg-surface pl-3 text-[12px] font-bold tabular-nums text-ink"
            >
              {DAY_LABEL.get(s.weekday) ?? "?"} {hhmm(s.startTime)} -{" "}
              {hhmm(s.endTime)}
              <button
                type="button"
                onClick={() => remove(s)}
                disabled={pending}
                aria-label={`Remove ${DAY_LABEL.get(s.weekday) ?? ""} ${hhmm(s.startTime)} to ${hhmm(s.endTime)}`}
                className="group/remove grid h-9 w-9 place-items-center rounded-[9px] text-ink-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50"
              >
                <span className="grid h-[22px] w-[22px] place-items-center rounded-[7px] bg-surface-3 transition-colors group-hover/remove:bg-bad-bg group-hover/remove:text-bad">
                  <X className="h-3 w-3" aria-hidden />
                </span>
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2.5">
        <label className={LABEL}>
          Day
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
        <label className={LABEL}>
          From
          <TimeSelect placeholder="From" className={INPUT} value={start} onChange={setStart} />
        </label>
        <label className={LABEL}>
          To
          <TimeSelect placeholder="To" className={INPUT} value={end} onChange={setEnd} />
        </label>
        <Button type="button" onClick={add} disabled={pending} className="h-[38px]">
          Add slot
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-[12px] font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
