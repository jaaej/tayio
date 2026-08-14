"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Native date field that narrows the lesson list to a single day. Writes to the
 * `date` URL param so the view is shareable and survives a reload, and follows
 * FilterToolbar's conventions: replace rather than push (picking through a week
 * should not stack seven history entries) and no scroll jump.
 */
export function DayPicker() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const date = searchParams.get("date") ?? "";

  function write(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("date", next);
    else params.delete("date");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
      <label className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-[12px] font-bold text-ink-soft">
          Jump to day
        </span>
        <input
          type="date"
          value={date}
          onChange={(e) => write(e.target.value)}
          className={cn(
            "h-9 max-w-full rounded-[10px] border border-line-field bg-surface px-3",
            "text-[13px] text-ink tabular-nums transition-colors",
            "focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20",
          )}
        />
      </label>

      {date && (
        <button
          type="button"
          onClick={() => write("")}
          className={cn(
            "inline-flex min-h-9 items-center rounded-full border border-line-strong bg-surface px-4",
            "text-[12px] font-bold text-ink transition-colors",
            "hover:border-brand-500 hover:text-brand-700",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
          )}
        >
          All days
        </button>
      )}
    </div>
  );
}
