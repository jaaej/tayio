import Link from "next/link";
import { Empty, PageHeader } from "@/components/admin/ui";
import { VideoViewerButton } from "@/components/ui/video-viewer";
import { formatTimeRange } from "@/lib/format";
import type { FamilyRecap } from "@/lib/lesson-recap";
import { recapBlocks, recapPreview } from "@/lib/lesson-recap-rules";
import { LESSON_STATUS_LABEL } from "@/lib/status";
import { subjectTone } from "@/lib/subject-tone";
import { hostedEmbedUrl } from "@/lib/video-embed";

/*
 * A lesson recap as families read it, the same for the student and their
 * parent: the tutor's family fields (`lesson-recap-rules`) as tinted blocks.
 * `LessonRecapView` is the whole page (/student/resources/[id],
 * /parent/feedback/[lessonId]); `RecapCard` is one recap in a list (parent
 * Feedback, a subject's feedback).
 */

const dayLabel = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function lessonDay(date: string): string {
  return dayLabel.format(new Date(`${date}T00:00:00Z`));
}

/** The filled family fields as blocks, or nothing when none is written. */
export function RecapBlocks({ recap }: { recap: FamilyRecap }) {
  const blocks = recapBlocks(recap.note);
  if (blocks.length === 0) return null;
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-1.5">
      {blocks.map((b) => (
        <div
          key={b.field}
          className="panel flex flex-col gap-1.5 p-4"
          style={{ borderTop: `3px solid ${b.accent}` }}
        >
          <span className="text-[12px] font-extrabold uppercase tracking-[0.04em] text-muted">
            {b.label}
          </span>
          <span className="whitespace-pre-wrap text-[14px] leading-[1.55] text-ink">{b.body}</span>
        </div>
      ))}
    </div>
  );
}

/** One lesson's recap page: the lesson, its recording and the recap. */
export function LessonRecapView({
  recap,
  back,
  emptyText,
}: {
  recap: FamilyRecap;
  back: { href: string; label: string };
  /** Shown while the tutor has not written anything for the family. */
  emptyText: string;
}) {
  const embedSrc = recap.recordingUrl ? hostedEmbedUrl(recap.recordingUrl) : null;
  const statusNote =
    recap.status === "cancelled" || recap.status === "missed"
      ? LESSON_STATUS_LABEL[recap.status]
      : null;

  return (
    <div className="max-w-[1080px] space-y-5">
      <PageHeader
        back={back}
        eyebrow={
          <>
            <span
              aria-hidden
              className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
              style={{ backgroundColor: subjectTone(recap.subjectName, recap.subjectColor).dot }}
            />
            <span>
              {[
                recap.className,
                lessonDay(recap.date),
                formatTimeRange(recap.startTime, recap.endTime),
                recap.tutorName && `with ${recap.tutorName}`,
                statusNote,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </>
        }
        title={recap.note?.topicCovered?.trim() || recap.subjectName}
      />

      {recap.recordingUrl && (
        <section aria-label="Lesson recording" className="glass rounded-[24px] p-1.5">
          {embedSrc ? (
            <div className="aspect-video w-full overflow-hidden rounded-[18px] bg-ink">
              <iframe
                src={embedSrc}
                title={`${recap.subjectName} lesson recording`}
                className="h-full w-full"
                allow="accelerated-media; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex aspect-[16/7] w-full flex-col items-center justify-center gap-3 rounded-[18px] bg-[linear-gradient(135deg,#17152B,#2E2944)] text-white">
              <VideoViewerButton
                url={recap.recordingUrl}
                title={`${recap.subjectName} lesson recording`}
                className="h-16 w-16 gap-0 border-0 bg-white p-0 text-ink hover:bg-white [&>svg]:h-[26px] [&>svg]:w-[26px]"
              >
                <span className="sr-only">Play recording</span>
              </VideoViewerButton>
              <span className="text-[13px] font-semibold opacity-80">Lesson recording</span>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="rc-h" className="glass rounded-[24px] p-1.5">
        <h2 id="rc-h" className="px-3 pb-2.5 pt-2 text-[16px] font-extrabold text-ink">
          {recap.tutorFirstName ? `Recap from ${recap.tutorFirstName}` : "Recap"}
        </h2>
        {recap.note ? (
          <RecapBlocks recap={recap} />
        ) : (
          <div className="panel">
            <Empty>{emptyText}</Empty>
          </div>
        )}
      </section>
    </div>
  );
}

/** One recap in a list: subject, lesson and tutor, then the blocks. */
export function RecapCard({ recap, href }: { recap: FamilyRecap; href?: string }) {
  const heading = (
    <>
      <span
        aria-hidden
        className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
        style={{ backgroundColor: subjectTone(recap.subjectName, recap.subjectColor).dot }}
      />
      <span className="truncate">{recap.subjectName}</span>
    </>
  );
  return (
    <section
      id={`recap-${recap.lessonId}`}
      aria-labelledby={`recap-h-${recap.lessonId}`}
      className="glass scroll-mt-24 rounded-[24px] p-1.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 pb-2.5 pt-2">
        <h2
          id={`recap-h-${recap.lessonId}`}
          className="flex min-w-0 items-center gap-2 text-[16px] font-extrabold text-ink"
        >
          {href ? (
            <Link href={href} className="flex min-w-0 items-center gap-2 hover:underline">
              {heading}
            </Link>
          ) : (
            heading
          )}
        </h2>
        <span className="text-[13px] font-semibold text-ink-soft">
          {[lessonDay(recap.date), recap.tutorName].filter(Boolean).join(" · ")}
        </span>
      </div>
      <RecapBlocks recap={recap} />
    </section>
  );
}

/**
 * Recaps as one-line previews that open the full recap (a summary surface,
 * such as the parent Overview's "From the tutor").
 */
export function RecapPreviewList({ items }: { items: Array<{ recap: FamilyRecap; href: string }> }) {
  return (
    <ul className="divide-y divide-line">
      {items.map(({ recap, href }) => (
        <li key={recap.lessonId}>
          <Link
            href={href}
            className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
          >
            <span
              aria-hidden
              className="mt-[7px] h-2 w-2 shrink-0 rounded-[3px]"
              style={{ backgroundColor: subjectTone(recap.subjectName, recap.subjectColor).dot }}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[13px] font-bold text-ink">
                  {[recap.subjectName, recap.tutorName].filter(Boolean).join(" · ")}
                </span>
                <span className="shrink-0 text-[12px] text-muted">{lessonDay(recap.date)}</span>
              </span>
              <span className="line-clamp-2 text-[13px] leading-relaxed text-ink-soft">
                {recapPreview(recap.note)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
