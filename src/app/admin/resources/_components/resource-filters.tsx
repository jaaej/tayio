"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RESOURCE_TYPES } from "@/lib/resource-types";

const selectClass =
  "rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-line-strong";

export function ResourceFilters({
  subjects,
}: {
  subjects: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      <select
        defaultValue={searchParams.get("subjectId") ?? ""}
        onChange={(e) => update("subjectId", e.target.value)}
        className={selectClass}
      >
        <option value="">All subjects</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <select
        defaultValue={searchParams.get("type") ?? ""}
        onChange={(e) => update("type", e.target.value)}
        className={selectClass}
      >
        <option value="">All types</option>
        {RESOURCE_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      <select
        defaultValue={searchParams.get("status") ?? ""}
        onChange={(e) => update("status", e.target.value)}
        className={selectClass}
      >
        <option value="">All statuses</option>
        <option value="live">Live</option>
        <option value="unpublished">Unpublished</option>
        <option value="removed">Removed</option>
      </select>
    </div>
  );
}
