import Link from "next/link";
import { subjectTone } from "@/lib/subject-tone";
import type { SubjectTab } from "../../_lib/subject-page";

/**
 * Hero in the subject colour (StudentSubjectColourPage): the subject tabs,
 * which replace the separate subjects list, then the week, its title, the
 * week's done ring and the message button.
 */
export function SubjectHeader({
  tabs,
  subjectId,
  subjectName,
  subjectColor,
  title,
  kicker,
  progress,
  tutorId,
  tutorFirstName,
}: {
  tabs: SubjectTab[];
  subjectId: string;
  subjectName: string;
  subjectColor: string | null;
  title: string;
  kicker?: string;
  progress?: { done: number; total: number };
  tutorId?: string;
  tutorFirstName?: string | null;
}) {
  const tone = subjectTone(subjectName, subjectColor);
  const bg = tone.flat;
  const deep = tone.fg;
  const pct =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <section
      aria-labelledby="sj-h"
      className="flex flex-col gap-[18px] rounded-[28px] px-[26px] pb-[18px] pt-[22px] text-white"
      style={{ background: bg }}
    >
      <nav aria-label="Subjects" className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => {
          const active = tab.subjectId === subjectId;
          return (
            <Link
              key={tab.subjectId}
              href={`/student/subjects/${tab.subjectId}`}
              aria-current={active ? "page" : undefined}
              className="flex h-[34px] items-center gap-2 rounded-[17px] px-3.5 text-[13px]"
              style={
                active
                  ? { background: "#FFFFFF", color: deep, fontWeight: 800 }
                  : { background: "rgba(255,255,255,.18)", color: "#FFFFFF", fontWeight: 700 }
              }
            >
              {tab.subjectName}
              {tab.dueCount > 0 && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-[#FFD600] px-[5px] text-[11px] font-extrabold text-[#1B1240]">
                  {tab.dueCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          {kicker && <span className="text-[13px] font-bold opacity-85">{kicker}</span>}
          <h1 id="sj-h" className="m-0 text-[34px] font-extrabold tracking-[-0.01em]">
            {title}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {progress && progress.total > 0 && (
            <span
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full"
              style={{ background: `conic-gradient(#FFFFFF ${pct}%, rgba(255,255,255,.25) 0)` }}
            >
              <span
                className="flex h-[58px] w-[58px] flex-col items-center justify-center rounded-full leading-[1.05]"
                style={{ background: bg }}
              >
                <span className="text-[18px] font-extrabold">
                  {progress.done}/{progress.total}
                </span>
                <span className="text-[10px] font-extrabold opacity-85">DONE</span>
              </span>
            </span>
          )}
          {tutorId && tutorFirstName && (
            <Link
              href={`/student/messages/with/${tutorId}`}
              className="flex h-11 items-center rounded-[14px] bg-white px-[18px] text-[14px] font-extrabold transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-[3px] hover:shadow-[0_16px_30px_rgba(23,21,43,0.16)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              style={{ color: deep }}
            >
              Message {tutorFirstName}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
