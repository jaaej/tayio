"use client";

import { TimeSelect } from "@/components/ui/time-select";
import { endTimeAfterStartChange } from "@/app/admin/classes/_lib/class-time";
import { cn } from "@/lib/utils";

const PART =
  "h-full min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-[14px] tabular-nums text-ink outline-none";

/**
 * A class's start and end as one field: "5:00 pm to 6:30 pm". Two dropdowns
 * share one border. Moving the start keeps the lesson's length.
 */
export function TimeRangeField({
  labelledBy,
  start,
  end,
  onChange,
  lessonMinutes,
  className,
}: {
  /** The visible "Time" label. */
  labelledBy: string;
  start: string;
  end: string;
  onChange: (times: { startTime: string; endTime: string }) => void;
  /** The usual lesson length, for an end time when there is none yet. */
  lessonMinutes: number;
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
      <TimeSelect
        aria-label="Starts"
        placeholder="Start"
        value={start}
        onChange={(next) =>
          onChange({
            startTime: next,
            endTime: endTimeAfterStartChange({ previousStart: start, previousEnd: end, nextStart: next, lessonMinutes }),
          })
        }
        className={PART}
      />
      <span aria-hidden className="text-[14px] text-[#9A9AAD]">
        to
      </span>
      <TimeSelect
        aria-label="Ends"
        placeholder="End"
        value={end}
        onChange={(next) => onChange({ startTime: start, endTime: next })}
        className={PART}
      />
    </div>
  );
}
