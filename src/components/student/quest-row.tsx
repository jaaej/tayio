import Link from "next/link";
import { Check, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Pill } from "./pill";
import { SubjectPill } from "./subject-pill";

/**
 * Quest row - homework reframed as a quest, with a checkbox and XP pill.
 * The subject is a colour-coded pill (same family the subject uses
 * everywhere); the due date sits beside it as a neutral chip. Replaces
 * the old cramped "{subject} · {meta}" sub line.
 * Display-only here (no toggle); pass `done` to drive the visual state.
 */
export function QuestRow({
  title,
  subject,
  meta,
  xp,
  done,
  href,
}: {
  title: string;
  subject: string;
  meta: string;
  xp: number;
  done?: boolean;
  href?: string;
}) {
  const inner = (
    <div
      className={cn(
        "flex items-center gap-3.5 px-4 py-3.5 transition-colors",
        href && "hover:bg-surface-2",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "w-[26px] h-[26px] rounded-[9px] grid place-items-center shrink-0 border-2 transition-colors",
          done
            ? "bg-mint border-mint text-white"
            : "border-line-strong text-transparent",
        )}
      >
        <Check className="h-[15px] w-[15px]" />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "text-[14px] font-bold truncate",
            done ? "line-through text-muted" : "text-ink",
          )}
        >
          {title}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <SubjectPill subject={subject} />
          <Pill tone="neutral">{meta}</Pill>
        </div>
      </div>
      <span className="ml-auto inline-flex items-center gap-1 bg-brand-50 text-brand-600 text-[11px] font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0">
        <Zap className="h-3 w-3" />
        {xp} XP
      </span>
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
