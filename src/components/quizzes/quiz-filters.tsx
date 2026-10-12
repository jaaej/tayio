"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { SegmentedLinks } from "@/components/admin/ui";
import { LabelledSelect } from "@/components/admin/ui/labelled-select";

const DEBOUNCE_MS = 250;

/**
 * Search, status and subject controls for the quiz table (admin and tutor
 * Quizzes), sitting on the table's glass title row. Everything lives in the URL so a filtered view is
 * shareable and the back button restores it; the search box keeps local state
 * so typing never waits on the server.
 */
export function QuizFilters({
  statuses,
  subjects,
}: {
  statuses: { value: string; label: string }[];
  subjects: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryParam = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const subject = searchParams.get("subject") ?? "";

  const [query, setQuery] = useState(queryParam);
  const pushed = useRef(queryParam);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adopt the URL only when it moved on its own (back button, a cleared
  // filter) - never while our own debounced write is in flight.
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

  /** URL for one param change; carries the not-yet-debounced query across so
   *  switching a filter mid-type never drops what was typed. */
  function hrefFor(param: string, value: string, q = query) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(param, value);
    else params.delete(param);
    if (q) params.set("q", q);
    else params.delete("q");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function commitQuery(next: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pushed.current = next;
  }

  function onQueryChange(next: string) {
    setQuery(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      pushed.current = next;
      // replace, not push: one history entry per keystroke would make the
      // back button retype the query a character at a time.
      router.replace(hrefFor("q", next, next), { scroll: false });
    }, DEBOUNCE_MS);
  }

  function clearQuery() {
    commitQuery("");
    setQuery("");
    router.replace(hrefFor("q", "", ""), { scroll: false });
  }

  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-[220px]">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search quizzes"
          aria-label="Search quizzes"
          className="h-9 w-full rounded-[10px] border border-white/95 bg-surface pl-8 pr-9 text-[13px] text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={clearQuery}
            aria-label="Clear search"
            className="absolute right-0 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-[10px] text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      <div
        className="max-w-full"
        onClickCapture={() => commitQuery(query)}
      >
        <SegmentedLinks
          className="flex-wrap"
          label="Filter by status"
          items={statuses.map((s) => ({
            label: s.label,
            href: hrefFor("status", s.value),
            active: status === s.value,
          }))}
        />
      </div>
      {subjects.length > 1 && (
        <LabelledSelect
          label="Subject"
          value={subjects.includes(subject) ? subject : ""}
          options={[
            { value: "", label: "All" },
            ...subjects.map((name) => ({ value: name, label: name })),
          ]}
          onChange={(value) => {
            commitQuery(query);
            router.push(hrefFor("subject", value), { scroll: false });
          }}
        />
      )}
    </div>
  );
}
