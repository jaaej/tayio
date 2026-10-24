"use client";

import { formatTime } from "@/lib/format";
import { timeOptions } from "@/lib/time-options";
import { cn } from "@/lib/utils";

/**
 * A time as a dropdown (every 15 minutes, 6 am to 10 pm, keeping a saved time
 * off that grid). Unlike a typed time box it reports a choice the moment it is
 * made in every browser, so what is shown is always what saves.
 */
export function TimeSelect({
  value,
  onChange,
  placeholder,
  className,
  ...props
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange"> & {
  /** HH:MM (24h), or "" for none. */
  value: string;
  onChange: (time: string) => void;
  /** The empty choice, e.g. "Start". */
  placeholder: string;
}) {
  const current = value.slice(0, 5);
  return (
    <select
      {...props}
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className={cn("cursor-pointer", !current && "text-[#9A9AAD]", className)}
    >
      <option value="">{placeholder}</option>
      {timeOptions({ keep: current }).map((t) => (
        <option key={t} value={t} className="text-ink">
          {formatTime(t)}
        </option>
      ))}
    </select>
  );
}
