"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { formatTimeRange } from "@/lib/format";
import { classTimeRangeError } from "@/lib/recurring-lesson-rules";
import { cn } from "@/lib/utils";
import { durationLabel, endTimeAfterStartChange } from "../_lib/class-time";

/*
 * Fields shared by the New class panel and the class detail form, so creating
 * and editing a class look and behave the same.
 */

export const FIELD =
  "h-11 w-full min-w-0 rounded-[12px] border border-line-field bg-surface px-3.5 text-[15px] text-ink transition-colors placeholder:text-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10 disabled:opacity-60";

export type ClassTypeValue = "group" | "one_on_one";

const CLASS_TYPES: { value: ClassTypeValue; label: string }[] = [
  { value: "group", label: "Group" },
  { value: "one_on_one", label: "One-on-one" },
];

/** Monday first, as the schedule reads; values are JS weekdays (Sun = 0). */
const DAYS = [
  { value: 1, short: "M", label: "Mon", full: "Monday" },
  { value: 2, short: "T", label: "Tue", full: "Tuesday" },
  { value: 3, short: "W", label: "Wed", full: "Wednesday" },
  { value: 4, short: "T", label: "Thu", full: "Thursday" },
  { value: 5, short: "F", label: "Fri", full: "Friday" },
  { value: 6, short: "S", label: "Sat", full: "Saturday" },
  { value: 0, short: "S", label: "Sun", full: "Sunday" },
];

export function Field({
  id,
  label,
  optional,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-bold text-ink">
        {label}
        {optional && <span className="font-medium text-muted"> (optional)</span>}
      </label>
      {children}
    </div>
  );
}

/** Native select in the field style, with its own chevron. */
export function SelectField({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block min-w-0">
      <select
        {...props}
        className={cn(FIELD, "cursor-pointer appearance-none pr-9 text-[14px]", className)}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      />
    </span>
  );
}

/** Group / One-on-one as a segmented control over real radio inputs. */
export function ClassTypeSegment({
  value,
  onChange,
}: {
  value: ClassTypeValue;
  onChange: (value: ClassTypeValue) => void;
}) {
  const labelId = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={labelId} className="text-[13px] font-bold text-ink">
        Class type
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex gap-0.5 rounded-[12px] bg-[#F1F2F7] p-[3px]"
      >
        {CLASS_TYPES.map((option) => {
          const on = value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "inline-flex h-[38px] flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded-[10px] px-2 text-[14px] transition-colors",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400",
                on ? "bg-ink font-bold text-white" : "font-semibold text-ink-soft hover:text-ink",
              )}
            >
              <input
                type="radio"
                name="classType"
                value={option.value}
                checked={on}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Number field with − and + steppers. */
export function CapacityStepper({
  id,
  defaultValue,
}: {
  id: string;
  defaultValue: number;
}) {
  const [value, setValue] = useState(String(defaultValue));
  const step = (delta: number) => {
    const n = Number(value);
    const base = Number.isFinite(n) && n > 0 ? n : defaultValue;
    setValue(String(Math.min(200, Math.max(1, base + delta))));
  };
  const n = Number(value);
  const stepClass =
    "grid h-full w-11 shrink-0 place-items-center text-[18px] font-bold text-ink transition-colors hover:bg-[#F1F2F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 disabled:opacity-40";
  return (
    <Field id={id} label="Capacity">
      <div className="flex h-11 items-center overflow-hidden rounded-[12px] border border-line-field bg-surface focus-within:border-ink focus-within:ring-[3px] focus-within:ring-ink/10">
        <button
          type="button"
          aria-label="Decrease capacity"
          className={stepClass}
          disabled={n <= 1}
          onClick={() => step(-1)}
        >
          −
        </button>
        <input
          id={id}
          name="capacity"
          type="number"
          inputMode="numeric"
          min={1}
          max={200}
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-center text-[15px] font-bold tabular-nums text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label="Increase capacity"
          className={stepClass}
          disabled={n >= 200}
          onClick={() => step(1)}
        >
          +
        </button>
      </div>
    </Field>
  );
}

/**
 * Repeats-weekly switch, day picker and start/end times, with a live summary
 * that always spells out am/pm so a time picker left on AM is caught before
 * saving. Moving the start keeps the lesson's length.
 */
export function WhenFields({
  idPrefix,
  defaultRecurring,
  defaultWeekday,
  defaultStart,
  defaultEnd,
  lessonMinutes,
}: {
  idPrefix: string;
  defaultRecurring: boolean;
  defaultWeekday: number | null;
  defaultStart: string;
  defaultEnd: string;
  lessonMinutes: number;
}) {
  const [recurring, setRecurring] = useState(defaultRecurring);
  const [weekday, setWeekday] = useState<number | null>(defaultWeekday);
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const dayLabelId = `${idPrefix}-day`;
  const startId = `${idPrefix}-start`;
  const endId = `${idPrefix}-end`;

  const rangeError = classTimeRangeError(start, end);
  const length = durationLabel(start, end);
  const day = DAYS.find((d) => d.value === weekday);

  return (
    <div className="flex flex-col gap-3.5">
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-[13px] font-bold text-ink">
        Repeats weekly
        <span className="relative h-6 w-10 shrink-0">
          <input
            type="checkbox"
            role="switch"
            name="isRecurring"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
            className="peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
          />
          <span
            aria-hidden
            className="block h-6 w-10 rounded-full bg-[#C9CBDA] transition-colors peer-checked:bg-ink peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400 peer-focus-visible:ring-offset-1"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(23,21,43,0.2)] transition-transform duration-150 peer-checked:translate-x-4"
          />
        </span>
      </label>

      <div role="radiogroup" aria-labelledby={dayLabelId} className="flex flex-col gap-2">
        <span id={dayLabelId} className="text-[13px] font-bold text-ink">
          Day
        </span>
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS.map((d) => {
            const on = weekday === d.value;
            return (
              <label
                key={d.value}
                title={d.full}
                className={cn(
                  "inline-flex h-11 cursor-pointer items-center justify-center rounded-[12px] border text-[13px] font-bold transition-colors",
                  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400 has-[:focus-visible]:ring-offset-1",
                  on
                    ? "border-ink bg-ink text-white"
                    : "border-line-field bg-surface text-ink hover:border-[#B9BCD0]",
                )}
              >
                <input
                  type="radio"
                  name="weekday"
                  value={d.value}
                  checked={on}
                  aria-label={d.full}
                  onChange={() => setWeekday(d.value)}
                  // Clicking the chosen day again clears it.
                  onClick={() => {
                    if (on) setWeekday(null);
                  }}
                  className="sr-only"
                />
                <span aria-hidden className="sm:hidden">{d.short}</span>
                <span aria-hidden className="hidden sm:inline">{d.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field id={startId} label="Starts">
          <input
            id={startId}
            name="startTime"
            type="time"
            value={start}
            onChange={(e) => {
              const next = e.target.value;
              setEnd((prevEnd) =>
                endTimeAfterStartChange({
                  previousStart: start,
                  previousEnd: prevEnd,
                  nextStart: next,
                  lessonMinutes,
                }),
              );
              setStart(next);
            }}
            aria-describedby={`${idPrefix}-summary`}
            className={FIELD}
          />
        </Field>
        <Field id={endId} label="Ends">
          <input
            id={endId}
            name="endTime"
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            aria-invalid={rangeError ? true : undefined}
            aria-describedby={`${idPrefix}-summary`}
            className={cn(FIELD, rangeError && "border-bad focus:border-bad")}
          />
        </Field>
      </div>

      {(start && end) || rangeError ? (
        <div
          id={`${idPrefix}-summary`}
          role={rangeError ? "alert" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-[13px]",
            rangeError ? "bg-bad-bg font-semibold text-bad" : "bg-[#F4F5F9] text-ink-soft",
          )}
        >
          <Clock className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden />
          {rangeError ? (
            <span>{rangeError}</span>
          ) : (
            <span>
              {recurring && day ? (
                <>
                  Every <strong className="font-bold text-ink">{day.full}</strong>,{" "}
                </>
              ) : null}
              {formatTimeRange(start, end)}
              {length ? ` · ${length}` : ""}
            </span>
          )}
        </div>
      ) : (
        <span id={`${idPrefix}-summary`} hidden />
      )}
    </div>
  );
}
