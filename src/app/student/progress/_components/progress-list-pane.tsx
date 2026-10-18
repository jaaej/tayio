"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Download, FileText } from "lucide-react";
import { subjectTone } from "@/lib/subject-tone";
import { cn } from "@/lib/utils";
import type { ProgressPaneData, ProgressPaneSubject } from "../_lib/progress-data";

/**
 * Left pane of the progress split view (the same list pane as admin Users
 * and tutor Students): the term picker, an overall mastery ring, one item
 * per subject with its mastery bar, then the student's term reports. On
 * /student/progress wide screens show the first subject, so its item reads
 * as selected there. The term lives in the URL (`?term=`, left out for the
 * term running today) and every subject link carries it.
 */
export function ProgressListPane({
  overall,
  subjects,
  terms,
  defaultTermId,
  reports,
}: ProgressPaneData) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = /^\/student\/progress\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const defaultId = selectedId ? null : (subjects[0]?.subjectId ?? null);
  const requested = searchParams.get("term");
  const termId = terms.some((t) => t.id === requested) ? requested : defaultTermId;
  const query = termId && termId !== defaultTermId ? `?term=${termId}` : "";
  const pct = overall ?? 0;

  return (
    <section
      aria-labelledby="pg-h"
      className={cn(
        "glass min-w-0 flex-col gap-1.5 rounded-[24px] p-1.5",
        "xl:sticky xl:top-[var(--portal-sticky-top)] xl:flex xl:w-[380px] xl:shrink-0",
        selectedId ? "hidden" : "flex",
      )}
    >
      <div className="flex items-center justify-between gap-3 pb-1 pl-3 pr-1 pt-1">
        <h1 id="pg-h" className="m-0 text-[20px] font-extrabold text-[#17152B]">
          Progress
        </h1>
        {terms.length > 0 && termId && (
          <label className="relative flex items-center">
            <span className="sr-only">Term</span>
            <select
              value={termId}
              onChange={(e) => {
                const next = e.target.value;
                router.push(next === defaultTermId ? pathname : `${pathname}?term=${next}`);
              }}
              className="h-10 appearance-none rounded-[12px] border border-white/95 bg-white/80 pl-3.5 pr-9 text-[14px] font-extrabold text-[#17152B] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute right-3 h-4 w-4 text-[#5E5A73]"
            />
          </label>
        )}
      </div>

      <div className="panel flex items-center gap-3.5 p-4">
        <span
          className="flex h-16 w-16 flex-none items-center justify-center rounded-[32px]"
          style={{ background: `conic-gradient(#17152B ${pct}%, #EEEFF6 0)` }}
        >
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[26px] bg-white text-[15px] font-extrabold text-[#17152B]">
            {overall === null ? "-" : `${overall}%`}
          </span>
        </span>
        <span className="text-[15px] font-extrabold text-[#17152B]">Overall mastery</span>
      </div>

      <div className="panel flex flex-col gap-0.5 p-1.5">
        {subjects.length === 0 ? (
          <p className="px-6 py-10 text-center text-[13px] text-[#5E5A73]">
            Your progress appears here once you&apos;re enrolled in a class.
          </p>
        ) : (
          subjects.map((s) => (
            <SubjectItem
              key={s.subjectId}
              subject={s}
              href={`/student/progress/${s.subjectId}${query}`}
              selected={s.subjectId === selectedId}
              selectedOnDesktop={s.subjectId === defaultId}
            />
          ))
        )}
      </div>

      <section aria-labelledby="pg-reports" className="panel flex flex-col gap-0.5 p-1.5">
        <h2 id="pg-reports" className="m-0 px-2.5 pb-1 pt-2 text-[14px] font-extrabold text-[#17152B]">
          Reports
        </h2>
        {reports === null ? (
          <p className="px-2.5 pb-2.5 text-[13px] text-[#5E5A73]">
            Your term reports go to your parent.
          </p>
        ) : reports.length === 0 ? (
          <p className="px-2.5 pb-2.5 text-[13px] text-[#5E5A73]">No reports yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {reports.map((r) => (
              <li key={r.termId}>
                <a
                  href={r.href}
                  download
                  className="flex items-center gap-3 rounded-[12px] p-2.5 text-[#17152B] transition-colors hover:bg-[#F6F7FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
                >
                  <span
                    aria-hidden
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#EEEBFD] text-[#3A1AA8]"
                  >
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-bold">
                    {r.label} report
                  </span>
                  <Download aria-hidden className="h-4 w-4 shrink-0 text-[#5E5A73]" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function SubjectItem({
  subject,
  href,
  selected,
  selectedOnDesktop,
}: {
  subject: ProgressPaneSubject;
  href: string;
  selected: boolean;
  selectedOnDesktop: boolean;
}) {
  const dot = subjectTone(subject.subjectName, subject.subjectColor).dot;
  const tracked = subject.masteryPercent !== null;

  return (
    <Link
      href={href}
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
          style={{ width: `${subject.masteryPercent ?? 0}%`, background: dot }}
        />
      </span>
    </Link>
  );
}
