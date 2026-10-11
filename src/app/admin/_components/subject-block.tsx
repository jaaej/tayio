import type { ReactNode } from "react";
import Link from "next/link";
import { SubjectDot } from "@/components/admin/ui";
import { yearLevelLabel } from "@/lib/format";

/**
 * One subject as a small white block that opens its curriculum. Shared by the
 * Classes page's subject list and the Curriculum page so both read the same.
 */
export function SubjectBlock({
  id,
  name,
  yearLevel,
  detail,
}: {
  id: string;
  name: string;
  yearLevel: string | null;
  /** Extra fact appended to the year level line (e.g. weeks planned). */
  detail?: ReactNode;
}) {
  return (
    <Link
      href={`/admin/subjects/${id}/curriculum`}
      className="group flex min-w-0 items-center gap-2.5 rounded-[14px] border border-line/70 bg-surface px-3.5 py-3 shadow-[0_1px_2px_rgba(15,17,30,0.04)] transition-all duration-150 hover:-translate-y-[2px] hover:shadow-[0_10px_22px_-14px_rgba(31,40,90,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <SubjectDot subject={name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-ink" title={name}>
          {name}
        </span>
        <span className="block truncate text-[12px] text-muted">
          {yearLevel ? yearLevelLabel(yearLevel) : "No level set"}
          {detail ? <> · {detail}</> : null}
        </span>
      </span>
      <span className="shrink-0 text-[12px] font-bold text-brand-600 group-hover:underline">
        Curriculum
      </span>
    </Link>
  );
}
