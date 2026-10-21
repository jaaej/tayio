"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterSelect } from "@/components/admin/ui";
import { RESOURCE_TYPES } from "@/lib/resource-types";

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
    <div className="flex flex-wrap items-center gap-2.5">
      <FilterSelect
        label="Filter by subject"
        value={searchParams.get("subjectId") ?? ""}
        onChange={(v) => update("subjectId", v)}
        options={[
          { value: "", label: "All subjects" },
          ...subjects.map((s) => ({ value: s.id, label: s.name })),
        ]}
      />
      <FilterSelect
        label="Filter by type"
        value={searchParams.get("type") ?? ""}
        onChange={(v) => update("type", v)}
        options={[
          { value: "", label: "All types" },
          ...RESOURCE_TYPES.map((t) => ({ value: t.value, label: t.label })),
        ]}
      />
      <FilterSelect
        label="Filter by status"
        value={searchParams.get("status") ?? ""}
        onChange={(v) => update("status", v)}
        options={[
          { value: "", label: "All statuses" },
          { value: "live", label: "Live" },
          { value: "unpublished", label: "Unpublished" },
          { value: "removed", label: "Removed" },
        ]}
      />
    </div>
  );
}
