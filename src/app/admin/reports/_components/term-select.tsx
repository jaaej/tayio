"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";

type Option = { id: string; label: string };

export function TermSelect({
  terms,
  selectedId,
}: {
  terms: Option[];
  selectedId: string;
}) {
  const router = useRouter();
  return (
    <Select
      value={selectedId}
      onChange={(e) => router.push(`/admin/reports?term=${e.target.value}`)}
      aria-label="Select term"
    >
      {terms.map((t) => (
        <option key={t.id} value={t.id}>
          {t.label}
        </option>
      ))}
    </Select>
  );
}
