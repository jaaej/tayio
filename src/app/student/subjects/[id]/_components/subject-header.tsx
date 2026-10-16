import Link from "next/link";
import { HERO_ACTION, HERO_PILL, SubjectHero } from "@/components/subjects/subject-hero";
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
  const showRing = Boolean(progress && progress.total > 0);
  const showMessage = Boolean(tutorId && tutorFirstName);
  return (
    <SubjectHero
      subjectName={subjectName}
      subjectColor={subjectColor}
      title={title}
      kicker={kicker}
      nav={
        <nav aria-label="Subjects" className="flex flex-wrap gap-1.5">
          {tabs.map((tab) => {
            const active = tab.subjectId === subjectId;
            return (
              <Link
                key={tab.subjectId}
                href={`/student/subjects/${tab.subjectId}`}
                aria-current={active ? "page" : undefined}
                className={HERO_PILL}
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
      }
      actions={
        (showRing || showMessage) && (
          <>
            {progress && showRing && (
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
            {showMessage && (
              <Link
                href={`/student/messages/with/${tutorId}`}
                className={HERO_ACTION}
                style={{ color: deep }}
              >
                Message {tutorFirstName}
              </Link>
            )}
          </>
        )
      }
    />
  );
}
