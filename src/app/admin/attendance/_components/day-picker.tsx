"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

/**
 * Native date field that narrows the lesson queue to a single day. Writes to
 * the `date` URL param so the view is shareable and survives a reload, and
 * keeps the other queue params. Replace rather than push (picking through a
 * week should not stack seven history entries) and no scroll jump.
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
    <div className="flex min-w-0 items-center gap-2">
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-[12px] font-bold text-ink-soft">Day</span>
        <input
          type="date"
          value={date}
          onChange={(e) => write(e.target.value)}
          className={cn(
            "h-9 min-w-0 flex-1 rounded-[10px] border border-line-strong bg-surface px-3",
            "text-[13px] font-semibold text-ink tabular-nums transition-colors",
            "focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-400/30",
          )}
        />
      </label>
      {date && (
        <button
          type="button"
          onClick={() => write("")}
          className={buttonVariants({ variant: "glass", size: "md" })}
        >
          All days
        </button>
      )}
    </div>
  );
}
