"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { subjectTone } from "@/lib/subject-tone";
import { cn } from "@/lib/utils";
import type { ProgressPaneData, ProgressPaneSubject } from "../_lib/progress-data";

/**
 * Left pane of the progress split view (the same list pane as admin Users
 * and tutor Students): an overall mastery ring, then one item per subject
 * with its mastery bar and focus topic. On /student/progress wide screens
 * show the first subject, so its item reads as selected there.
 */
export function ProgressListPane({ overall, subjects }: ProgressPaneData) {
  const pathname = usePathname();
  const selectedId = /^\/student\/progress\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const defaultId = selectedId ? null : (subjects[0]?.subjectId ?? null);
  const pct = overall.percent ?? 0;

  return (
    <section
      aria-labelledby="pg-h"
      className={cn(
        "glass min-w-0 flex-col gap-1.5 rounded-[24px] p-1.5",
        "xl:sticky xl:top-[var(--portal-sticky-top)] xl:flex xl:w-[380px] xl:shrink-0",
        selectedId ? "hidden" : "flex",
      )}
    >
      <div className="pb-1 pl-3 pr-2 pt-2">
        <h1 id="pg-h" className="m-0 text-[20px] font-extrabold text-[#17152B]">
          Progress
        </h1>
      </div>

      <div className="panel flex items-center gap-3.5 p-4">
        <span
          className="flex h-16 w-16 flex-none items-center justify-center rounded-[32px]"
          style={{ background: `conic-gradient(#17152B ${pct}%, #EEEFF6 0)` }}
        >
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[26px] bg-white text-[15px] font-extrabold text-[#17152B]">
            {overall.percent === null ? "-" : `${overall.percent}%`}
          </span>
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-[15px] font-extrabold text-[#17152B]">Overall mastery</span>
          <span className="text-[12px] text-[#5E5A73]">
            {overall.topics === 0
              ? "No topics tracked yet"
              : `${overall.topics} ${overall.topics === 1 ? "topic" : "topics"} tracked · ${overall.strong} mastered · ${overall.improving} improving · ${overall.focus} to focus`}
          </span>
        </span>
      </div>

      <div className="panel flex flex-1 flex-col gap-0.5 p-1.5">
        {subjects.length === 0 ? (
          <p className="px-6 py-10 text-center text-[13px] text-[#5E5A73]">
            Your progress appears here once you&apos;re enrolled in a class.
          </p>
        ) : (
          subjects.map((s) => (
            <SubjectItem
              key={s.subjectId}
              subject={s}
              selected={s.subjectId === selectedId}
              selectedOnDesktop={s.subjectId === defaultId}
            />
          ))
        )}
      </div>
    </section>
  );
}

function SubjectItem({
  subject,
  selected,
  selectedOnDesktop,
}: {
  subject: ProgressPaneSubject;
  selected: boolean;
  selectedOnDesktop: boolean;
}) {
  const dot = subjectTone(subject.subjectName).dot;
  const tracked = subject.topicCount > 0;
  const meta = !tracked
    ? "No topics tracked yet"
    : [
        `${subject.topicCount} ${subject.topicCount === 1 ? "topic" : "topics"}`,
        subject.focus ? `focus: ${subject.focus}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <Link
      href={`/student/progress/${subject.subjectId}`}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "flex flex-col gap-2 rounded-[12px] p-3 text-[#17152B] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400",
        selected ? "bg-[#F1F2F7]" : "hover:bg-[#F6F7FA]",
        selectedOnDesktop && "xl:bg-[#F1F2F7]",
      )}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden className="h-[9px] w-[9px] rounded-[3px]" style={{ background: dot }} />
        <span className="min-w-0 flex-1 truncate text-[14px] font-extrabold">{subject.subjectName}</span>
        <span className="text-[14px] font-extrabold tabular-nums">
          {tracked ? `${subject.masteryPercent}%` : "-"}
        </span>
      </span>
      <span aria-hidden className="h-1.5 overflow-hidden rounded-[3px] bg-[#EEEFF6]">
        <span
          className="block h-full"
          style={{ width: `${tracked ? subject.masteryPercent : 0}%`, background: dot }}
        />
      </span>
      <span className="truncate text-[12px] text-[#5E5A73]">{meta}</span>
    </Link>
  );
}
