"use client";

import { cn } from "@/lib/utils";

const TIME =
  "h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[14px] tabular-nums text-ink outline-none [&::-webkit-calendar-picker-indicator]:hidden";

/**
 * A class's start and end as one field: "5:00 pm to 6:30 pm". Two native time
 * inputs share one border, so typing and the phone time wheel still work.
 */
export function TimeRangeField({
  labelledBy,
  start,
  end,
  onChange,
  className,
}: {
  /** The visible "Time" label. */
  labelledBy: string;
  start: string;
  end: string;
  onChange: (times: { startTime: string; endTime: string }) => void;
  /** Border, height and radius of the field, from the form. */
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className={cn(
        "flex items-center gap-2 focus-within:border-ink focus-within:ring-[3px] focus-within:ring-ink/10",
        className,
      )}
    >
      <input
        type="time"
        aria-label="Starts"
        value={start}
        onChange={(e) => onChange({ startTime: e.target.value, endTime: end })}
        className={TIME}
      />
      <span aria-hidden className="text-[14px] text-[#9A9AAD]">
        to
      </span>
      <input
        type="time"
        aria-label="Ends"
        value={end}
        onChange={(e) => onChange({ startTime: start, endTime: e.target.value })}
        className={TIME}
      />
    </div>
  );
}
