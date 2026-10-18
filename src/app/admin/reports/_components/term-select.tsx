"use client";

import { useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  return (
    <LabelledSelect
      label="Term"
      value={selectedId}
      options={terms.map((t) => ({ value: t.id, label: t.label }))}
      onChange={(value) => {
        // Keep the view and class; only the term changes.
        const params = new URLSearchParams(searchParams.toString());
        params.set("term", value);
        router.push(`/admin/reports?${params.toString()}`);
      }}
    />
  );
}
