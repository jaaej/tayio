"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

/**
 * Mobile-only filter sheet for the account directory. On desktop the filters
 * live inline in the table header; on narrow screens those controls scroll off
 * with the table, so this collapsible panel is the one reachable home for them
 * below `lg`. Same URL search params as the header controls - no divergent
 * state - so switching viewport keeps the active filter.
 */
const SELECT =
  "w-full rounded-[10px] border border-line-field bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";
const LABEL =
  "grid gap-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted";

export function UserMobileFilters({ schools }: { schools: string[] }) {
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

  const role = searchParams.get("role") ?? "";
  const school = searchParams.get("school") ?? "";
  const status = searchParams.get("status") ?? "";
  const nameSort = searchParams.get("name") === "desc" ? "desc" : "asc";
  const activeCount = [role, school, status].filter(Boolean).length;

  return (
    <details className="group lg:hidden">
      <summary className="flex cursor-pointer items-center justify-between gap-2 rounded-[10px] border border-line-strong bg-surface-2 px-4 py-2.5 text-[13px] font-bold text-ink [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted" />
          Filters
          {activeCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[10px] font-extrabold text-white">
              {activeCount}
            </span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2 grid gap-3 rounded-[10px] border border-line bg-surface p-3">
        <label className={LABEL}>
          Role
          <select
            className={SELECT}
            value={role}
            onChange={(e) => update("role", e.target.value)}
          >
            <option value="">All roles</option>
            <option value="admin">Admins</option>
            <option value="tutor">Tutors</option>
            <option value="parent">Parents</option>
            <option value="student">Students</option>
          </select>
        </label>
        <label className={LABEL}>
          Year / school
          <select
            className={SELECT}
            value={school}
            onChange={(e) => update("school", e.target.value)}
          >
            <option value="">All schools</option>
            {schools.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          Status
          <select
            className={SELECT}
            value={status}
            onChange={(e) => update("status", e.target.value)}
          >
            <option value="">Active</option>
            <option value="discontinued">Discontinued</option>
            <option value="all">Active + discontinued</option>
          </select>
        </label>
        <label className={LABEL}>
          Sort by name
          <select
            className={SELECT}
            value={nameSort}
            onChange={(e) =>
              update("name", e.target.value === "desc" ? "desc" : "")
            }
          >
            <option value="asc">A to Z</option>
            <option value="desc">Z to A</option>
          </select>
        </label>
      </div>
    </details>
  );
}
