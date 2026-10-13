import { Check } from "lucide-react";
import { PdfViewerButton } from "@/components/ui/pdf-viewer";
import { httpHref } from "@/lib/safe-url";
import { subjectTone } from "@/lib/subject-tone";
import { pastDayLabel } from "../../_lib/week-checklist";
import type { StudentCurriculumWeek } from "../_queries";
import { VideoPlayer } from "./video-player";

const POP =
  "transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-[3px] hover:shadow-[0_16px_30px_rgba(23,21,43,0.16)] motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/** "By the end of this week": the week's objectives as tinted rows. */
export function WeekGoals({
  week,
  subjectName,
}: {
  week: StudentCurriculumWeek;
  subjectName: string;
}) {
  const tone = subjectTone(subjectName);
  const objectives = (week.objectives ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!week.description && objectives.length === 0) return null;
  return (
    <section
      aria-labelledby="ov-h"
      className="glass min-w-0 flex-[1_1_300px] rounded-[24px] p-1.5"
    >
      <h2 id="ov-h" className="m-0 px-3 pb-2.5 pt-2 text-[16px] font-extrabold">
        By the end of this week
      </h2>
      <div className="panel flex flex-col gap-2 p-4">
        {week.description && (
          <p className="whitespace-pre-line text-[14px] leading-[1.65]">{week.description}</p>
        )}
        {objectives.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-[14px] font-bold"
            style={{ background: tone.bg, color: tone.fg }}
          >
            <Check
              className="h-[15px] w-[15px] shrink-0"
              style={{ color: tone.dot }}
              strokeWidth={3}
              aria-hidden
            />
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

/** "From {tutor}": the tutor's "For students this week" plan field. */
export function TutorNote({
  week,
  subjectName,
  tutorFirstName,
  now,
}: {
  week: StudentCurriculumWeek;
  subjectName: string;
  tutorFirstName: string | null;
  now: Date;
}) {
  if (!week.tutorNote && week.tutorAttachments.length === 0) return null;
  const tone = subjectTone(subjectName);
  const chip = `flex h-[38px] max-w-full items-center gap-2 rounded-[12px] px-3.5 text-[13px] font-extrabold ${POP}`;
  return (
    <section
      aria-labelledby="ft-h"
      className="glass min-w-0 flex-[1_1_300px] rounded-[24px] p-1.5"
    >
      <div className="flex items-center justify-between pb-2.5 pl-3 pr-2 pt-2">
        <h2 id="ft-h" className="m-0 text-[16px] font-extrabold">
          From {tutorFirstName ?? "your tutor"}
        </h2>
        {week.tutorNoteUpdatedAt && (
          <span className="text-[12px] font-semibold text-[#2E2944]">
            {pastDayLabel(week.tutorNoteUpdatedAt, now)}
          </span>
        )}
      </div>
      <div className="panel flex flex-col gap-3 p-4">
        {week.tutorNote && (
          <div className="whitespace-pre-line text-[14px] leading-[1.65]">{week.tutorNote}</div>
        )}
        {week.tutorAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {week.tutorAttachments.map((att) => {
              const href = httpHref(att.url);
              const style = { background: tone.bg, color: tone.fg };
              if (href && att.kind === "file" && att.fileName.toLowerCase().endsWith(".pdf")) {
                return (
                  <span key={att.id} className={`inline-flex max-w-full rounded-[12px] ${POP}`} style={style}>
                    <PdfViewerButton
                      url={href}
                      title={att.fileName}
                      className="h-[38px] min-h-0 max-w-full rounded-[12px] border-0 bg-transparent px-3.5 text-[13px] font-extrabold text-inherit hover:bg-transparent"
                    >
                      <span className="truncate">{att.fileName}</span>
                    </PdfViewerButton>
                  </span>
                );
              }
              return href ? (
                <a
                  key={att.id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={chip}
                  style={style}
                >
                  <span className="truncate">{att.fileName}</span>
                </a>
              ) : (
                <span key={att.id} className={chip} style={{ ...style, opacity: 0.6 }}>
                  <span className="truncate">{att.fileName}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/** The recorded lesson; playing it ticks the video card off. */
export function Recording({
  week,
  src,
}: {
  week: StudentCurriculumWeek;
  src: string | null;
}) {
  if (!week.videoUrl) return null;
  return (
    <section
      id="recording"
      aria-labelledby="rec-h"
      className="glass scroll-mt-5 rounded-[24px] p-1.5"
    >
      <h2 id="rec-h" className="m-0 px-3 pb-2.5 pt-2 text-[16px] font-extrabold">
        Recorded lesson
      </h2>
      <div className="panel p-3">
        {src ? (
          <VideoPlayer
            src={src}
            subjectWeekId={week.subjectWeekId}
            alreadyWatched={Boolean(week.videoWatchedAt)}
          />
        ) : (
          <p className="px-2 py-8 text-center text-[14px] text-[#5E5A73]">
            The recording could not be loaded. Refresh the page to try again.
          </p>
        )}
      </div>
    </section>
  );
}
