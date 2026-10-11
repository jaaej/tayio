"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Native select laid transparently over a "Label  Value" face, so keyboard
 * and mobile pickers work with no popover code. A non-default value tints the
 * face, so an active filter reads from the text and the tint together.
 */
export function LabelledSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  const active = value !== "";
  return (
    <span
      className={cn(
        "relative inline-flex h-10 max-w-[240px] items-center gap-2 rounded-[10px] border pl-3 pr-2 text-[13px] transition-colors focus-within:ring-2 focus-within:ring-brand-400",
        active
          ? "border-brand-300 bg-brand-50"
          : "border-line-strong bg-surface hover:bg-surface-2",
      )}
    >
      <span aria-hidden className="font-semibold text-muted">
        {label}
      </span>
      <span aria-hidden className="truncate font-bold text-ink">
        {current.label}
      </span>
      <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.value || "default"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

/** A LabelledSelect bound to one URL search param; the empty value clears it. */
export function UrlLabelledSelect({
  label,
  param,
  options,
}: {
  label: string;
  param: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <LabelledSelect
      label={label}
      value={searchParams.get(param) ?? ""}
      options={options}
      onChange={(value) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) params.set(param, value);
        else params.delete(param);
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }}
    />
  );
}
