"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

/**
 * Compact dropdown for filter/sort bars. The selected option always reads as a
 * full statement ("All roles", "Name A-Z") so the control is self-describing
 * without a separate visible label; `label` becomes its accessible name.
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none min-h-11 w-full rounded-[8px] border border-line-field bg-surface pl-3 pr-9 text-[13px] font-medium text-ink cursor-pointer transition-colors hover:border-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted"
        aria-hidden
      />
    </div>
  );
}
