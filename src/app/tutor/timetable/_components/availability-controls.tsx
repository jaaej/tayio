"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Trash2 } from "lucide-react";
import {
  addRecurringAvailability,
  removeRecurringAvailability,
} from "@/app/tutor/_actions";
import { SidePanel } from "@/components/ui/side-panel";

export type WeeklyAvailabilityWindow = {
  weekday: number;
  dayLabel: string;
  timeLabel: string;
  ruleIds: string[];
};

type Result = { ok: true; message: string } | { ok: false; error: string };

const FIELD =
  "min-h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25";
const PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-brand-600 px-5 text-[12px] font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50";

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];
const TIMES = Array.from({ length: 18 }, (_, index) => {
  const hour = index + 6;
  const displayHour = hour % 12 || 12;
  return {
    value: `${String(hour).padStart(2, "0")}:00`,
    label: `${displayHour}:00 ${hour < 12 ? "AM" : "PM"}`,
  };
});

export function AvailabilityControls({
  weeklyWindows,
}: {
  weeklyWindows: WeeklyAvailabilityWindow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ good: boolean; text: string } | null>(null);

  function run(action: (formData: FormData) => Promise<Result>, formData: FormData) {
    setStatus(null);
    startTransition(async () => {
      const result = await action(formData);
      setStatus({
        good: result.ok,
        text: result.ok ? result.message : result.error,
      });
      if (result.ok) router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setStatus(null);
          setOpen(true);
        }}
        className="inline-flex min-h-10 items-center gap-2 rounded-full bg-brand-600 px-4 text-[12px] font-bold text-white transition-colors hover:bg-brand-700"
      >
        <CalendarRange className="h-4 w-4" aria-hidden />
        Weekly availability
      </button>

      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title="Weekly availability"
        sub="Set the hours you can usually teach. These repeat every week."
        size="wide"
      >
        <div id="availability" className="space-y-5">
          {status && (
            <p
              role="status"
              className={`rounded-[10px] border px-3.5 py-2.5 text-[12px] font-semibold ${
                status.good
                  ? "border-good/35 bg-good-bg text-good"
                  : "border-bad/35 bg-bad-bg text-bad"
              }`}
            >
              {status.text}
            </p>
          )}

          <form
            action={(formData) => run(addRecurringAvailability, formData)}
            className="grid gap-3 sm:grid-cols-2"
          >
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                Day
              </span>
              <select name="weekday" className={FIELD} defaultValue="1" disabled={pending}>
                {DAYS.map((day) => (
                  <option key={day.value} value={day.value}>{day.label}</option>
                ))}
              </select>
            </label>
            <TimeField label="Available from" name="startTime" defaultValue="15:00" disabled={pending} />
            <TimeField label="Available until" name="endTime" defaultValue="18:00" disabled={pending} />
            <button type="submit" disabled={pending} className={`${PRIMARY} sm:col-span-2 sm:justify-self-start`}>
              {pending ? "Saving…" : "Add recurring hours"}
            </button>
          </form>

          <div className="border-t border-line pt-5">
            <h3 className="text-[13px] font-extrabold text-ink">Your regular week</h3>
            {weeklyWindows.length === 0 ? (
              <p className="mt-2 rounded-[10px] bg-surface-2 px-3 py-3 text-[12px] text-muted">
                No recurring availability has been added yet.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {weeklyWindows.map((window) => (
                  <li
                    key={`${window.weekday}-${window.timeLabel}-${window.ruleIds.join("-")}`}
                    className="flex items-center justify-between gap-3 rounded-[10px] border border-line bg-surface-2/60 px-3 py-2.5"
                  >
                    <div>
                      <div className="text-[12px] font-extrabold text-ink">{window.dayLabel}</div>
                      <div className="mt-0.5 text-[12px] text-ink-soft">{window.timeLabel}</div>
                    </div>
                    <form action={(formData) => run(removeRecurringAvailability, formData)}>
                      {window.ruleIds.map((id) => (
                        <input key={id} type="hidden" name="ruleId" value={id} />
                      ))}
                      <button
                        type="submit"
                        disabled={pending}
                        aria-label={`Remove ${window.dayLabel} ${window.timeLabel}`}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-[11px] font-bold text-ink hover:border-bad hover:text-bad disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SidePanel>
    </>
  );
}

function TimeField({
  label,
  name,
  defaultValue,
  disabled,
}: {
  label: string;
  name: string;
  defaultValue: string;
  disabled: boolean;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{label}</span>
      <select
        name={name}
        required
        defaultValue={defaultValue}
        disabled={disabled}
        className={FIELD}
      >
        {TIMES.map((time) => (
          <option key={time.value} value={time.value}>{time.label}</option>
        ))}
      </select>
    </label>
  );
}
