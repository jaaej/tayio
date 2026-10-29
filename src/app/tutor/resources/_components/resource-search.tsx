"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

const DEBOUNCE_MS = 250;

/**
 * The library's search box in the page header. It writes `?q=` (the server
 * filters the library) and keeps local state so typing never waits on the
 * round-trip; anything else in the URL is kept.
 */
export function ResourceSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryParam = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(queryParam);
  const pushed = useRef(queryParam);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adopt the URL only when it moved on its own (back button, a link) -
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
    const qs = params.toString();
    // replace, not push: one history entry per keystroke would make the back
    // button retype the query a character at a time.
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <label className="relative w-full sm:w-[240px]">
      <span className="sr-only">Search resources</span>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted"
        aria-hidden
      />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => write(next.trim()), DEBOUNCE_MS);
        }}
        placeholder="Search resources"
        className="h-[42px] w-full rounded-[12px] border border-white/95 bg-surface pl-9 pr-10 text-[13px] text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 [&::-webkit-search-cancel-button]:hidden"
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
          className="absolute right-0.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-[10px] text-muted hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </label>
  );
}
