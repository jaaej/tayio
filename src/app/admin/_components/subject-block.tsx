import type { ReactNode } from "react";
import Link from "next/link";
import { SubjectDot } from "@/components/admin/ui";
import { yearLevelLabel } from "@/lib/format";
import { SubjectPanel } from "../classes/_components/subject-panel";

/**
 * One subject as a small white block in the Classes page's Subjects panel:
 * the block opens its curriculum, the pencil opens Edit subject.
 */
export function SubjectBlock({
  id,
  name,
  color,
  yearLevel,
  detail,
}: {
  id: string;
  name: string;
  /** The subject's stored colour (`subjects.color`). */
  color: string | null;
  yearLevel: string | null;
  /** Extra fact appended to the year level line (e.g. weeks planned). */
  detail?: ReactNode;
}) {
  return (
    <div className="flex h-full min-w-0 items-center rounded-[12px] border border-line bg-surface pr-1 transition-colors duration-150 hover:bg-[#F8F9FC]">
      <Link
        href={`/admin/subjects/${id}/curriculum`}
        className="group flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-[12px] py-2.5 pl-3 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <SubjectDot subject={name} color={color} className="h-2.5 w-2.5" />
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
          <span className="min-w-0 text-[14px] font-bold leading-snug text-ink [overflow-wrap:anywhere]">
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
      <SubjectPanel subject={{ id, name, yearLevel, color }} />
    </div>
  );
}
