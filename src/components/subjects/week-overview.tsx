import { Check } from "lucide-react";
import { subjectTone } from "@/lib/subject-tone";

/**
 * "Overview" in the deep subject colour, shared by the student and admin
 * curriculum pages: the week's description, then "By the end of this week
 * you can" with the objectives (one per line) as ticked items.
 *
 * With neither, it renders nothing, unless `emptyText` is given (admin, who
 * needs to see that the week has no overview yet).
 */
export function WeekOverview({
  subjectName,
  subjectColor,
  description,
  objectives,
  emptyText,
  note,
}: {
  subjectName: string;
  /** The subject's stored colour (`subjects.color`). */
  subjectColor: string | null;
  description: string | null;
  objectives: string | null;
  emptyText?: string;
  /** Small label beside the heading, e.g. "Set by admin" for tutors. */
  note?: string;
}) {
  const deep = subjectTone(subjectName, subjectColor).deep;
  const items = (objectives ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!description && items.length === 0 && !emptyText) return null;
  return (
    <section
      aria-labelledby="ov-h"
      className="flex flex-col gap-4 rounded-[24px] px-[22px] py-5 text-white"
      style={{ background: deep }}
    >
      {note ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="ov-h" className="m-0 text-[19px] font-extrabold">
            Overview
          </h2>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] opacity-85">
            {note}
          </span>
        </div>
      ) : (
        <h2 id="ov-h" className="m-0 text-[19px] font-extrabold">
          Overview
        </h2>
      )}
      {description && (
        <p className="m-0 whitespace-pre-line text-[15px] leading-[1.6] opacity-95">{description}</p>
      )}
      {!description && items.length === 0 && (
        <p className="m-0 text-[15px] opacity-85">{emptyText}</p>
      )}
      {items.length > 0 && (
        <div className="flex flex-col gap-3 rounded-[16px] bg-white/[0.12] px-4 py-3.5">
          <h3 className="m-0 text-[11px] font-extrabold uppercase tracking-[0.16em] opacity-85">
            By the end of this week you can
          </h3>
          <ul className="m-0 grid list-none gap-x-6 gap-y-2.5 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr))]">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[14px] font-bold leading-[1.4]">
                <span
                  aria-hidden
                  className="mt-px grid h-[20px] w-[20px] shrink-0 place-items-center rounded-[6px] bg-white"
                  style={{ color: deep }}
                >
                  <Check className="h-[13px] w-[13px]" strokeWidth={3.2} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
