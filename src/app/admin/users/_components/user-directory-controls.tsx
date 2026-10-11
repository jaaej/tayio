"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { LabelledSelect } from "@/components/admin/ui/labelled-select";

const DEBOUNCE_MS = 250;

/**
 * Search, status, sort, and school controls for the user directory. Every
 * control writes to the URL so a filtered view is shareable and the back
 * button restores it; the search box keeps local state so typing never waits
 * on a server round-trip. Role lives on the stat tiles above, its one home.
 */
export function UserDirectoryControls({ schools }: { schools: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryParam = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(queryParam);
  const pushed = useRef(queryParam);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adopt the URL only when it changed on its own (back button, a tile link),
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
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
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
    <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
      <label className="relative min-w-[220px] flex-1 lg:w-[300px] lg:flex-none">
        <span className="sr-only">Search users</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search name, email, class or subject"
          className="h-10 w-full rounded-[10px] border border-line-strong bg-surface pl-9 pr-9 text-[13px] text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 [&::-webkit-search-cancel-button]:hidden"
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

      <LabelledSelect
        label="Status"
        value={searchParams.get("status") ?? ""}
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
          value={searchParams.get("school") ?? ""}
          onChange={(v) => update("school", v)}
          options={[
            { value: "", label: "All" },
            ...schools.map((s) => ({ value: s, label: s })),
          ]}
        />
      )}
      <LabelledSelect
        label="Sort"
        value={searchParams.get("name") === "desc" ? "desc" : ""}
        onChange={(v) => update("name", v)}
        options={[
          { value: "", label: "Name A–Z" },
          { value: "desc", label: "Name Z–A" },
        ]}
      />
    </div>
  );
}
