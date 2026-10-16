import { notFound } from "next/navigation";
import { Empty, PageHeader } from "@/components/admin/ui";
import { VideoViewerButton } from "@/components/ui/video-viewer";
import { requireRole } from "@/lib/auth";
import { formatTimeRange } from "@/lib/format";
import { LESSON_STATUS_LABEL } from "@/lib/status";
import { subjectTone } from "@/lib/subject-tone";
import { hostedEmbedUrl } from "@/lib/video-embed";
import { getLessonRecap } from "../../_lib/queries";

const dayLabel = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export default async function LessonRecapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole("student");
  const lesson = await getLessonRecap(user.id, id);
  if (!lesson) notFound();

  // Parent-visible note fields only. `getLessonRecap` never selects the
  // tutor's internal note, so it cannot leak here. Accent colours per block
  // come from the StudentRecapPage handoff.
  const blocks = [
    { label: "Topic covered", body: lesson.topicCovered, accent: "#17152B" },
    { label: "Key concepts", body: lesson.keyConcepts, accent: "#3B4FD8" },
    { label: "What went well", body: lesson.strengths, accent: "#15803D" },
    { label: "What to revise", body: lesson.struggles, accent: "#D97706" },
    { label: "Next lesson focus", body: lesson.nextLessonFocus, accent: "#7C62F0" },
    { label: "From your tutor", body: lesson.parentVisibleComment, accent: "#2E9C86" },
  ].filter((b): b is { label: string; body: string; accent: string } =>
    Boolean(b.body?.trim()),
  );

  const embedSrc = lesson.recordingUrl ? hostedEmbedUrl(lesson.recordingUrl) : null;
  const statusNote =
    lesson.status === "cancelled" || lesson.status === "missed"
      ? LESSON_STATUS_LABEL[lesson.status]
      : null;
  const tutorName = `${lesson.tutorFirstName} ${lesson.tutorLastName}`.trim();

  return (
    <div className="max-w-[1080px] space-y-5">
      <PageHeader
        back={{ href: "/student/resources", label: "All resources" }}
        eyebrow={
          <>
            <span
              aria-hidden
              className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
              style={{ backgroundColor: subjectTone(lesson.subjectName, lesson.subjectColor).dot }}
            />
            <span>
              {[
                lesson.className,
                dayLabel.format(new Date(`${lesson.date}T12:00:00`)),
                formatTimeRange(lesson.startTime, lesson.endTime),
                tutorName && `with ${tutorName}`,
                statusNote,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </>
        }
        title={lesson.topicCovered?.trim() || lesson.subjectName}
      />

      {lesson.recordingUrl && (
        <section aria-label="Lesson recording" className="glass rounded-[24px] p-1.5">
          {embedSrc ? (
            <div className="aspect-video w-full overflow-hidden rounded-[18px] bg-ink">
              <iframe
                src={embedSrc}
                title={`${lesson.subjectName} lesson recording`}
                className="h-full w-full"
                allow="accelerated-media; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex aspect-[16/7] w-full flex-col items-center justify-center gap-3 rounded-[18px] bg-[linear-gradient(135deg,#17152B,#2E2944)] text-white">
              <VideoViewerButton
                url={lesson.recordingUrl}
                title={`${lesson.subjectName} lesson recording`}
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
          {lesson.tutorFirstName ? `Recap from ${lesson.tutorFirstName}` : "Recap"}
        </h2>
        {blocks.length === 0 ? (
          <div className="panel">
            <Empty>Your tutor hasn&apos;t written a recap for this lesson yet. Check back later.</Empty>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-1.5">
            {blocks.map((b) => (
              <div
                key={b.label}
                className="panel flex flex-col gap-1.5 p-4"
                style={{ borderTop: `3px solid ${b.accent}` }}
              >
                <span className="text-[12px] font-extrabold uppercase tracking-[0.04em] text-muted">
                  {b.label}
                </span>
                <span className="whitespace-pre-wrap text-[14px] leading-[1.55] text-ink">
                  {b.body}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
