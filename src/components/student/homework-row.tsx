import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  colorFamilyForSubject,
  getAccentTokens,
} from "@/lib/subject-colors";

/**
 * Homework row — subject color bar + title + meta (subject · due X).
 * Replaces the gamified QuestRow. No XP, no checkbox, no emoji.
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
        <div className="text-[12px] text-muted truncate mt-0.5">
          {subject} · {meta}
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
