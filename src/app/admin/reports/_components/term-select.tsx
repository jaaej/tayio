"use client";

import { useRouter } from "next/navigation";
import { LabelledSelect } from "@/components/admin/ui/labelled-select";

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
    <LabelledSelect
      label="Term"
      value={selectedId}
      options={terms.map((t) => ({ value: t.id, label: t.label }))}
      onChange={(value) => router.push(`/admin/reports?term=${value}`)}
    />
  );
}
