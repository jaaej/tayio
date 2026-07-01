import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Pill } from "./pill";
import { SubjectPill } from "./subject-pill";
import {
  colorFamilyForSubject,
  getAccentTokens,
} from "@/lib/subject-colors";

/**
 * Homework row — subject color bar + title + chips (subject + due).
 * The subject is a colour-coded pill (same family the subject uses
 * everywhere); the due date sits beside it as a neutral chip. Replaces
 * the old cramped "{subject} · {meta}" meta line.
 */
export function HomeworkRow({
  title,
  subject,
  meta,
  href,
}: {
  title: string;
  subject: string;
  meta: string;
  href?: string;
}) {
  const tokens = getAccentTokens(colorFamilyForSubject(subject));
  const inner = (
    <div className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-surface-2">
      <div
        aria-hidden
        className="w-1 self-stretch rounded-full shrink-0"
        style={{ background: tokens.arrow }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-bold text-ink truncate">{title}</div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <SubjectPill subject={subject} />
          <Pill tone="neutral">{meta}</Pill>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted shrink-0" />
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}
