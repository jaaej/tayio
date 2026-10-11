"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { LabelledSelect } from "@/components/admin/ui/labelled-select";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 250;

/**
 * Search plus the Status / School / Sort filters for the user list. Every
 * control writes to the URL (on whichever users route is open, so a selected
 * profile stays selected) and the search box keeps local state so typing
 * never waits on a round-trip. Filters fold behind one button to keep the
 * narrow list pane calm, and start open whenever one is in use.
 */
export function UserDirectoryControls({ schools }: { schools: string[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryParam = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(queryParam);
  const pushed = useRef(queryParam);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const status = searchParams.get("status") ?? "";
  const school = searchParams.get("school") ?? "";
  const sort = searchParams.get("name") === "desc" ? "desc" : "";
  const activeFilters = [status, school, sort].filter(Boolean).length;
  const [filtersOpen, setFiltersOpen] = useState(activeFilters > 0);

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

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("new");
    const qs = params.toString();
    // The list filters on the client, so the URL only needs to change, not
    // the server render: the native history API updates useSearchParams
    // without re-fetching the open profile on every keystroke.
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }

  function onQueryChange(next: string) {
    setQuery(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      pushed.current = next.trim();
      update("q", next.trim());
    }, DEBOUNCE_MS);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search users</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Name, email, class or subject"
            className="h-[38px] w-full rounded-[11px] border border-white/90 bg-surface pl-9 pr-9 text-[13px] text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                if (timer.current) clearTimeout(timer.current);
                setQuery("");
                pushed.current = "";
                update("q", "");
              }}
              aria-label="Clear search"
              className="absolute right-0.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-[10px] text-muted hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </label>
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-controls="user-directory-filters"
          className={cn(
            "inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-[11px] border px-3 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
            filtersOpen || activeFilters > 0
              ? "border-white bg-white text-ink"
              : "border-white/95 bg-white/65 text-ink hover:bg-white",
          )}
        >
          <SlidersHorizontal className="h-[15px] w-[15px]" aria-hidden />
          Filters
          {activeFilters > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1.5 text-[11px] font-extrabold tabular-nums text-white">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {filtersOpen && (
        <div id="user-directory-filters" className="flex flex-wrap gap-1.5">
          <LabelledSelect
            label="Status"
            value={status}
            onChange={(v) => update("status", v)}
            options={[
              { value: "", label: "Active" },
              { value: "discontinued", label: "Discontinued" },
              { value: "all", label: "Any" },
            ]}
          />
          {schools.length > 0 && (
            <LabelledSelect
              label="School"
              value={school}
              onChange={(v) => update("school", v)}
              options={[
                { value: "", label: "All" },
                ...schools.map((s) => ({ value: s, label: s })),
              ]}
            />
          )}
          <LabelledSelect
            label="Sort"
            value={sort}
            onChange={(v) => update("name", v)}
            options={[
              { value: "", label: "Name A-Z" },
              { value: "desc", label: "Name Z-A" },
            ]}
          />
        </div>
      )}
    </div>
  );
}
