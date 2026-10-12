"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

const DEBOUNCE_MS = 250;

/**
 * The search box at the top of a split-view list pane (admin Users, tutor
 * Students). It writes `?q=` on whichever route is open, so a selected item
 * stays selected, and keeps local state so typing never waits on a
 * round-trip. `children` sit beside the box (e.g. a Filters button).
 */
export function ListPaneSearch({
  label,
  placeholder,
  dropParams = [],
  children,
}: {
  /** Accessible name of the input. */
  label: string;
  placeholder: string;
  /** Params to clear whenever the query changes (e.g. an open "new" panel). */
  dropParams?: string[];
  children?: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryParam = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(queryParam);
  const pushed = useRef(queryParam);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adopt the URL only when it changed on its own (back button, a link),
  // never while our own debounced write is in flight.
  useEffect(() => {
    if (queryParam !== pushed.current) {
      pushed.current = queryParam;
      setQuery(queryParam);
    }
  }, [queryParam]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function write(value: string) {
    pushed.current = value;
    const params = new URLSearchParams(window.location.search);
    if (value) params.set("q", value);
    else params.delete("q");
    for (const key of dropParams) params.delete(key);
    const qs = params.toString();
    // The list filters on the client, so the URL only needs to change, not
    // the server render: the native history API updates useSearchParams
    // without re-fetching the open detail pane on every keystroke.
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }

  function onChange(next: string) {
    setQuery(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => write(next.trim()), DEBOUNCE_MS);
  }

  return (
    <div className="flex items-center gap-1.5">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{label}</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-[38px] w-full rounded-[11px] border border-white/90 bg-surface pl-9 pr-9 text-[13px] text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              if (timer.current) clearTimeout(timer.current);
              setQuery("");
              write("");
            }}
            aria-label="Clear search"
            className="absolute right-0.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-[10px] text-muted hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </label>
      {children}
    </div>
  );
}
