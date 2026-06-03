import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProgressRing } from "./progress-ring";
import {
  colorFamilyForSubject,
  getAccentTokens,
} from "@/lib/subject-colors";

/**
 * Subject card — top accent stripe, colored initial tile, mastery ring,
 * name + next class. Color-coded from subject name via the project's
 * accent-family map; the same name always resolves to the same family
 * so colors are consistent across every page.
 */
export function SubjectCard({
  name,
  mastery,
  nextLabel,
  href,
}: {
  name: string;
  mastery: number;
  nextLabel?: string;
  href: string;
}) {
  const family = colorFamilyForSubject(name);
  const tokens = getAccentTokens(family);
  const ringColor = tokens.arrow;
  const ringTrack = tokens.bgFrom;
  const initial = name.charAt(0).toUpperCase();

  return (
    <Link
      href={href}
      className="group relative block bg-surface border border-line rounded-[22px] p-4 overflow-hidden transition-all hover:-translate-y-[3px] hover:shadow-[0_24px_60px_-20px_rgba(31,40,90,0.25)]"
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ background: ringColor }}
      />
      <div className="mt-1.5 flex items-center justify-between">
        <div
          className="h-[46px] w-[46px] rounded-[14px] grid place-items-center text-[20px] font-extrabold"
          style={{ background: tokens.bgFrom, color: tokens.arrow }}
        >
          {initial}
        </div>
        <ProgressRing
          value={mastery}
          color={ringColor}
          track={ringTrack}
        />
      </div>
      <div className="mt-3.5 text-[15px] font-extrabold text-ink leading-tight">
        {name}
      </div>
      <div className="text-[12px] text-muted mt-0.5">
        Mastery {Math.round(mastery)}%
      </div>
      <div className="mt-3.5 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-ink-soft truncate">
          {nextLabel ? `Next · ${nextLabel}` : "No upcoming class"}
        </span>
        <ArrowRight
          className="h-[15px] w-[15px] shrink-0"
          style={{ color: ringColor }}
        />
      </div>
    </Link>
  );
}
