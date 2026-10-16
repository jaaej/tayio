import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { subjectTone } from "@/lib/subject-tone";

/**
 * Hero in the subject colour at the top of the curriculum page, shared by the
 * student and admin portals: a navigation row (the student's subject tabs,
 * the admin's back button), then the week kicker and title on the left and
 * the page's actions on the right.
 */
export function SubjectHero({
  subjectName,
  subjectColor,
  nav,
  kicker,
  title,
  actions,
}: {
  subjectName: string;
  /** The subject's stored colour (`subjects.color`). */
  subjectColor: string | null;
  nav: React.ReactNode;
  kicker?: string;
  title: string;
  actions?: React.ReactNode;
}) {
  const bg = subjectTone(subjectName, subjectColor).flat;
  return (
    <section
      aria-labelledby="sj-h"
      className="flex flex-col gap-[18px] rounded-[28px] px-[26px] pb-[18px] pt-[22px] text-white"
      style={{ background: bg }}
    >
      {nav}
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          {kicker && <span className="text-[13px] font-bold opacity-85">{kicker}</span>}
          <h1 id="sj-h" className="m-0 text-[34px] font-extrabold tracking-[-0.01em]">
            {title}
          </h1>
        </div>
        {actions && <div className="flex items-center gap-4">{actions}</div>}
      </div>
    </section>
  );
}

/** Pill in the hero's navigation row; white is the selected or back pill. */
export const HERO_PILL =
  "flex h-[34px] items-center gap-2 rounded-[17px] px-3.5 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/** White action button on the hero; callers set the text to the subject's `fg`. */
export const HERO_ACTION =
  "flex h-11 cursor-pointer items-center rounded-[14px] bg-white px-[18px] text-[14px] font-extrabold transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-[3px] hover:shadow-[0_16px_30px_rgba(23,21,43,0.16)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/**
 * The hero's navigation row for a page that leaves the curriculum rather than
 * switching subjects (admin, who has every subject to choose from).
 */
export function SubjectHeroBack({
  href,
  label,
  subjectName,
  subjectColor,
}: {
  href: string;
  label: string;
  subjectName: string;
  subjectColor: string | null;
}) {
  const fg = subjectTone(subjectName, subjectColor).fg;
  return (
    <nav aria-label="Back" className="flex">
      <Link
        href={href}
        className={`${HERO_PILL} bg-white pl-2.5 font-extrabold transition-colors duration-150 hover:bg-white/90 motion-reduce:transition-none`}
        style={{ color: fg }}
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2.6} aria-hidden />
        {label}
      </Link>
    </nav>
  );
}
