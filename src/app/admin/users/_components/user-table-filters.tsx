"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownAZ, ArrowDownZA, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

const TH =
  "text-left px-5 py-2.5 text-[11px] uppercase tracking-[0.08em] text-muted font-bold whitespace-nowrap";

/** Filter + sort controls for the account directory, sat in the column they
 *  act on. State lives in the URL so a filtered view is shareable and the back
 *  button restores it. */
export function UserTableHeaderRow({ schools }: { schools: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const nameSort = searchParams.get("name") === "desc" ? "desc" : "asc";

  return (
    <tr className="bg-surface-2">
      <th
        scope="col"
        className={TH}
        aria-sort={nameSort === "desc" ? "descending" : "ascending"}
      >
        <span className="inline-flex items-center gap-2">
          Name
          <SortToggle
            direction={nameSort}
            onToggle={() => update("name", nameSort === "asc" ? "desc" : "")}
          />
        </span>
      </th>

      <th scope="col" className={TH}>
        Email
      </th>

      <th scope="col" className={TH}>
        <span className="inline-flex items-center gap-2">
          Role
          <ColumnFilter
            label="Filter by role"
            value={searchParams.get("role") ?? ""}
            onChange={(v) => update("role", v)}
            options={[
              { value: "", label: "All roles" },
              { value: "admin", label: "Admins" },
              { value: "tutor", label: "Tutors" },
              { value: "parent", label: "Parents" },
              { value: "student", label: "Students" },
            ]}
          />
        </span>
      </th>

      <th scope="col" className={TH}>
        <span className="inline-flex items-center gap-2">
          Year / school
          <ColumnFilter
            label="Filter by school"
            value={searchParams.get("school") ?? ""}
            onChange={(v) => update("school", v)}
            options={[
              { value: "", label: "All schools" },
              ...schools.map((s) => ({ value: s, label: s })),
            ]}
          />
        </span>
      </th>

      <th scope="col" className={TH}>
        <span className="inline-flex items-center gap-2">
          Status
          <ColumnFilter
            label="Filter by status"
            value={searchParams.get("status") ?? ""}
            onChange={(v) => update("status", v)}
            options={[
              { value: "", label: "Active" },
              { value: "discontinued", label: "Discontinued" },
              { value: "all", label: "Active + discontinued" },
            ]}
          />
        </span>
      </th>

      <th scope="col" className={`${TH} text-right`}>
        Actions
      </th>
    </tr>
  );
}

/**
 * Compact per-column filter. A native `<select>` sits transparently over the
 * trigger: full keyboard + mobile support with no popover code to get wrong.
 * The first option is the unfiltered default, so anything else renders as a
 * brand-tinted chip showing the value - the state reads from the text, not
 * from colour alone.
 */
function ColumnFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const active = value !== "";
  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <span
      className={cn(
        "relative inline-flex h-8 items-center gap-1.5 rounded-[8px] border pl-2 pr-1.5 transition-colors",
        "focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-1",
        active
          ? "border-brand-300 bg-brand-50 text-brand-700"
          : "border-line-field bg-surface text-muted hover:border-brand-500 hover:text-ink",
      )}
    >
      {/* Visual only - the select below already announces the same value. */}
      {active && (
        <span
          aria-hidden
          title={current.label}
          className="max-w-[120px] truncate text-[11px] font-bold normal-case tracking-normal"
        >
          {current.label}
        </span>
      )}
      <Filter className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {/* Overhangs the trigger by 6px top and bottom so the tap area clears
          44px without inflating the header row. */}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-x-0 -top-1.5 -bottom-1.5 w-full cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

/** Two-state sort, so it toggles on one click rather than opening a menu. */
function SortToggle({
  direction,
  onToggle,
}: {
  direction: "asc" | "desc";
  onToggle: () => void;
}) {
  const Icon = direction === "asc" ? ArrowDownAZ : ArrowDownZA;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={
        direction === "asc" ? "Sort names Z to A" : "Sort names A to Z"
      }
      className={cn(
        "relative inline-flex h-8 w-8 items-center justify-center rounded-[8px] border transition-colors",
        "after:absolute after:-inset-1.5 after:content-['']",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
        direction === "desc"
          ? "border-brand-300 bg-brand-50 text-brand-700"
          : "border-line-field bg-surface text-muted hover:border-brand-500 hover:text-ink",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}
