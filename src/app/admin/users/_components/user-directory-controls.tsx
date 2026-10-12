"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { LabelledSelect } from "@/components/admin/ui/labelled-select";
import { ListPaneSearch } from "@/components/admin/ui/list-pane-search";
import { cn } from "@/lib/utils";

/**
 * Search plus the Status / School / Sort filters for the user list. Every
 * control writes to the URL (on whichever users route is open, so a selected
 * profile stays selected). Filters fold behind one button to keep the narrow
 * list pane calm, and start open whenever one is in use.
 */
export function UserDirectoryControls({ schools }: { schools: string[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = searchParams.get("status") ?? "";
  const school = searchParams.get("school") ?? "";
  const sort = searchParams.get("name") === "desc" ? "desc" : "";
  const activeFilters = [status, school, sort].filter(Boolean).length;
  const [filtersOpen, setFiltersOpen] = useState(activeFilters > 0);

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("new");
    const qs = params.toString();
    // The list filters on the client, so the URL only needs to change, not
    // the server render: the native history API updates useSearchParams
    // without re-fetching the open profile.
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-col gap-2">
      <ListPaneSearch
        label="Search users"
        placeholder="Name, email, class or subject"
        dropParams={["new"]}
      >
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
      </ListPaneSearch>

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
