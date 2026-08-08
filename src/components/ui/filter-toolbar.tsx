"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FilterSelect,
  type FilterOption,
} from "@/components/admin/ui/filter-select";

const DEBOUNCE_MS = 250;

export type FilterPill = { value: string; label: string };

/**
 * Search box + an optional dropdown + one row of switch pills for a listing
 * page. All write to the URL, so a filtered view is shareable and the back
 * button restores it; the search box keeps its own local state so typing never
 * waits on a server round-trip.
 *
 * Renders as a bare toolbar band - the caller supplies the card, so the filters
 * and the table they act on read as one surface.
 */
export function FilterToolbar({
  searchPlaceholder,
  searchParam = "q",
  pillParam,
  pills,
  selectParam,
  selectLabel,
  selectOptions,
}: {
  searchPlaceholder: string;
  /** URL param the search box writes to. */
  searchParam?: string;
  /** URL param the pills write to; the "all" pill is the empty value. */
  pillParam: string;
  pills: FilterPill[];
  /**
   * Optional second dimension, as a dropdown between the search box and the
   * pills. Omit all three and the toolbar renders exactly as it does without
   * them. The empty-value option is the "all" case.
   */
  selectParam?: string;
  /** Accessible name for the dropdown, e.g. "Filter by subject". */
  selectLabel?: string;
  selectOptions?: FilterOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryParam = searchParams.get(searchParam) ?? "";
  const active = searchParams.get(pillParam) ?? "";
  const selected = selectParam ? (searchParams.get(selectParam) ?? "") : "";

  const [query, setQuery] = useState(queryParam);
  const pushed = useRef(queryParam);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adopt the URL only when it moved on its own (back button, a link that
  // cleared the filter) - never while our own debounced write is in flight.
  useEffect(() => {
    if (queryParam !== pushed.current) {
      pushed.current = queryParam;
      setQuery(queryParam);
    }
  }, [queryParam]);

  useEffect(() => () => clearTimer(), []);

  function clearTimer() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  function write(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set(searchParam, next);
    else params.delete(searchParam);
    const qs = params.toString();
    // replace, not push: a history entry per keystroke would make the back
    // button retype the query one character at a time.
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function onQueryChange(next: string) {
    setQuery(next);
    clearTimer();
    timer.current = setTimeout(() => {
      pushed.current = next;
      write(next);
    }, DEBOUNCE_MS);
  }

  function clearQuery() {
    clearTimer();
    setQuery("");
    pushed.current = "";
    write("");
  }

  /** Carries the not-yet-debounced query across, so switching filter mid-type
   *  does not silently drop what was typed. */
  function hrefFor(param: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(param, value);
    else params.delete(param);
    if (query) params.set(searchParam, query);
    else params.delete(searchParam);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  /** The href we are about to navigate to already carries `query`, so the
   *  pending debounced write would only replay a stale param set over it. */
  function commitQueryBeforeNav() {
    clearTimer();
    pushed.current = query;
  }

  function onSelectChange(value: string) {
    if (!selectParam) return;
    commitQueryBeforeNav();
    router.push(hrefFor(selectParam, value), { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
      {/* Bounded rather than greedy: a search field wider than its longest
          hit adds nothing, and the pills read better next to it than pushed
          to the far edge. Uncaps below sm so a wrapped row fills the width. */}
      <div className="relative w-full min-w-[220px] flex-1 sm:max-w-[320px]">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className={cn(
            "h-9 w-full rounded-[10px] border border-line-field bg-surface pl-9 pr-10 text-[13px] text-ink",
            "placeholder:text-muted/70 transition-colors",
            "focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20",
          )}
        />
        {query && (
          <button
            type="button"
            onClick={clearQuery}
            aria-label="Clear search"
            className="absolute right-0 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-[10px] text-muted transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {selectParam && selectOptions && selectOptions.length > 0 && (
        <FilterSelect
          variant="toolbar"
          label={selectLabel ?? "Filter"}
          value={selected}
          options={selectOptions}
          onChange={(value) => onSelectChange(value)}
          className="max-w-[220px]"
        />
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {pills.map((pill) => {
          const isActive = active === pill.value;
          return (
            <Link
              key={pill.value || "all"}
              href={hrefFor(pillParam, pill.value)}
              scroll={false}
              onClick={commitQueryBeforeNav}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center rounded-full border px-4 text-[12px] font-bold transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
                isActive
                  ? "border-ink bg-ink text-white"
                  : "border-line-strong bg-surface text-ink hover:border-brand-500 hover:text-brand-700",
              )}
            >
              {pill.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
