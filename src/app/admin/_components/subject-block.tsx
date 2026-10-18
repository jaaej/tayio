import type { ReactNode } from "react";
import Link from "next/link";
import { BookOpen, Pencil } from "lucide-react";
import { SubjectDot } from "@/components/admin/ui";
import { yearLevelLabel } from "@/lib/format";

/**
 * One subject as a small white block in the Classes page's Subjects panel,
 * with two labelled links: its curriculum, and its edit page (the subject and
 * all its classes).
 */
const ACTION =
  "inline-flex h-9 items-center gap-1.5 rounded-[10px] px-2.5 text-[12px] font-bold text-brand-600 transition-colors hover:bg-[#EEEFF6] hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

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
    <div className="flex h-full min-w-0 flex-col gap-1 rounded-[12px] border border-line bg-surface py-2.5 pl-3 pr-1.5 transition-colors duration-150 hover:bg-[#F8F9FC]">
      <div className="flex min-w-0 items-baseline gap-2.5 pr-1.5">
        <SubjectDot subject={name} color={color} className="h-2.5 w-2.5 shrink-0 self-center" />
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
          <span className="min-w-0 text-[14px] font-bold leading-snug text-ink [overflow-wrap:break-word]">
            {name}
          </span>
          <span className="whitespace-nowrap text-[12px] text-muted">
            {yearLevel ? yearLevelLabel(yearLevel) : "No level set"}
            {detail ? <> · {detail}</> : null}
          </span>
        </span>
      </div>
      <div className="-ml-2.5 flex flex-wrap items-center">
        <Link href={`/admin/subjects/${id}/curriculum`} className={ACTION}>
          <BookOpen className="h-[13px] w-[13px]" strokeWidth={2.2} aria-hidden />
          <span className="sr-only">{name} </span>
          Curriculum
        </Link>
        <Link
          href={`/admin/subjects/${id}/edit`}
          title="Edit the subject and its classes"
          className={ACTION}
        >
          <Pencil className="h-[13px] w-[13px]" strokeWidth={2.2} aria-hidden />
          <span className="sr-only">{name} </span>
          Classes
        </Link>
      </div>
    </div>
  );
}
