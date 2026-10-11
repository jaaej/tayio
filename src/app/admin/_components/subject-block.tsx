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
      className="group flex min-h-11 min-w-0 items-center gap-3 rounded-[12px] border border-line bg-surface px-3 py-2.5 transition-[background-color,transform] duration-150 hover:-translate-y-[1px] hover:bg-[#F8F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <SubjectDot subject={name} className="h-2.5 w-2.5" />
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
        <span className="truncate text-[14px] font-bold text-ink" title={name}>
          {name}
        </span>
        <span className="whitespace-nowrap text-[12px] text-muted">
          {yearLevel ? yearLevelLabel(yearLevel) : "No level set"}
          {detail ? <> · {detail}</> : null}
        </span>
      </span>
      <span className="shrink-0 text-[12px] font-bold text-brand-600 group-hover:text-brand-700">
        Curriculum
      </span>
    </Link>
  );
}
