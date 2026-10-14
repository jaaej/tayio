"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The header's search: a button that opens a field. It is a plain GET form,
 * so the search lands in the URL with the other filters carried as hidden
 * fields, and it still works before hydration.
 */
export function HomeworkSearch({
  q,
  hidden,
  clearHref,
}: {
  q: string;
  hidden: Record<string, string>;
  clearHref: string;
}) {
  const [open, setOpen] = useState(Boolean(q));
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && !q) input.current?.focus();
  }, [open, q]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search homework"
        title="Search homework"
        className={BOX}
      >
        <Search className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden />
      </button>
    );
  }

  return (
    <form
      method="get"
      role="search"
      className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[14px] bg-white px-3 shadow-[0_1px_2px_rgba(16,24,40,0.06)] focus-within:ring-2 focus-within:ring-brand-400 sm:w-[240px] sm:flex-none"
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Search className="h-4 w-4 shrink-0 text-muted" strokeWidth={2.2} aria-hidden />
      <input
        ref={input}
        name="q"
        type="search"
        defaultValue={q}
        aria-label="Search homework"
        placeholder="Search homework"
        className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-ink outline-none focus-visible:outline-none placeholder:font-medium placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !q) setOpen(false);
        }}
      />
      {q ? (
        <a href={clearHref} aria-label="Clear search" title="Clear search" className={CLEAR}>
          <X className="h-4 w-4" strokeWidth={2.2} aria-hidden />
        </a>
      ) : (
        <button type="button" onClick={() => setOpen(false)} aria-label="Close search" title="Close search" className={CLEAR}>
          <X className="h-4 w-4" strokeWidth={2.2} aria-hidden />
        </button>
      )}
    </form>
  );
}

const BOX = cn(
  "grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-white text-ink shadow-[0_1px_2px_rgba(16,24,40,0.06)]",
  "transition-colors duration-150 hover:bg-[#F5F6FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
);

const CLEAR =
  "grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";
