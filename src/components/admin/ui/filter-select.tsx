"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

/**
 * Compact dropdown for filter/sort bars. The selected option always reads as a
 * full statement ("All roles", "Name A-Z") so the control is self-describing
 * without a separate visible label; `label` becomes its accessible name.
 *
 * `variant` picks the context, not a new look to invent per page:
 * - `standalone` - its own filter bar, sized as a form control.
 * - `toolbar` - inside `FilterToolbar`, so it matches the search box's height
 *   and radius, and borrows the pills' on/off treatment: a dropdown holding a
 *   filter must read as "on" next to a pill that does the same job.
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  className,
  variant = "standalone",
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  className?: string;
  variant?: "standalone" | "toolbar";
}) {
  // Every caller uses the empty value for the "all" option, so an empty value
  // is the unfiltered state.
  const filtered = variant === "toolbar" && value !== "";

  return (
    <div
      className={cn(
        "group relative",
        // The chevron is a sibling of the select, so the wrapper carries the
        // colour it inherits.
        filtered ? "text-white" : "text-muted",
        className,
      )}
    >
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "appearance-none w-full pl-3 pr-9 text-[13px] cursor-pointer transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
          variant === "toolbar"
            ? "h-9 rounded-[10px] font-bold"
            : "min-h-11 rounded-[8px] font-medium",
          filtered
            ? "border border-ink bg-ink text-white"
            : variant === "toolbar"
              ? "border border-line-strong bg-surface text-ink hover:border-brand-500 hover:text-brand-700"
              : "border border-line-field bg-surface text-ink hover:border-brand-500",
        )}
      >
        {options.map((o) => (
          // The platform popup does not inherit the inverted trigger colours,
          // so the option list states its own.
          <option
            key={o.value}
            value={o.value}
            className="bg-surface font-normal text-ink"
          >
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={cn(
          "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors",
          !filtered && variant === "toolbar" && "group-hover:text-brand-700",
        )}
        aria-hidden
      />
    </div>
  );
}
