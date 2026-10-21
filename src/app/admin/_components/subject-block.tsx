import type { ReactNode } from "react";
import Link from "next/link";
import { BookOpen, Pencil } from "lucide-react";
import { subjectTone } from "@/lib/subject-tone";
import { yearLevelLabel } from "@/lib/format";

/**
 * One subject as a white card in the Classes page's Subjects panel, from the
 * owner's mock: a bar in the subject's colour beside its name and level, and
 * two buttons, its curriculum and its edit page (the subject and all its
 * classes).
 */
const ACTION =
  "inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-[11px] bg-surface-2 px-2 text-[14px] font-bold text-ink transition-colors duration-150 hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 pointer-coarse:h-11";

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
  /** Extra fact after the year level (its number of classes). */
  detail?: ReactNode;
}) {
  return (
    <div className="panel flex h-full min-w-0 flex-col gap-3.5 rounded-[18px] p-[15px]">
      <div className="flex min-w-0 gap-3">
        <span
          aria-hidden
          className="w-1 shrink-0 rounded-full"
          style={{ backgroundColor: subjectTone(name, color).dot }}
        />
        <span className="flex min-w-0 flex-col gap-0.5 py-0.5">
          <span title={name} className="truncate text-[17px] font-extrabold leading-tight tracking-[-0.01em] text-ink">
            {name}
          </span>
          <span className="truncate text-[14px] font-medium text-muted">
            {yearLevel ? yearLevelLabel(yearLevel) : "No level"}
            {detail ? <> · {detail}</> : null}
          </span>
        </span>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2.5">
        <Link href={`/admin/subjects/${id}/curriculum`} className={ACTION}>
          <BookOpen className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          <span className="sr-only">{name} </span>
          <span className="truncate">Curriculum</span>
        </Link>
        <Link
          href={`/admin/subjects/${id}/edit`}
          title="Edit the subject and its classes"
          className={ACTION}
        >
          <Pencil className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          <span className="sr-only">{name} </span>
          <span className="truncate">Classes</span>
        </Link>
      </div>
    </div>
  );
}
