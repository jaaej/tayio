import Link from "next/link";
import { signCurriculumUrl } from "@/lib/curriculum-storage";
import { formatDueDate, relativeTime } from "@/lib/format";
import { VideoPlayer } from "./video-player";
import { BookletLink } from "./booklet-link";
import type { StudentCurriculumWeek } from "../_queries";

export async function WeekContent({
  week,
  classId,
}: {
  week: StudentCurriculumWeek;
  classId: string;
}) {
  const videoSignedUrl = await signCurriculumUrl(week.videoUrl);
  const homeworkDone = week.homework.filter(
    (h) =>
      h.status === "marked" ||
      h.status === "submitted" ||
      h.status === "returned",
  ).length;
  const videoDone = Boolean(week.videoWatchedAt);
  const bookletDone = Boolean(week.bookletOpenedAt);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="text-xs uppercase tracking-[0.18em] text-muted">
          Week {week.weekNumber}
        </div>
        <h2 className="text-2xl font-medium text-ink">{week.title}</h2>
        {week.description && (
          <p className="text-sm text-ink-soft leading-relaxed">
            {week.description}
          </p>
        )}
      </header>

      <section className="space-y-2">
        <div className="text-sm font-medium text-ink uppercase tracking-wide">
          Recorded lesson
        </div>
        {videoSignedUrl ? (
          <>
            <VideoPlayer
              src={videoSignedUrl}
              subjectWeekId={week.subjectWeekId}
              alreadyWatched={videoDone}
            />
            <div className="text-xs text-ink-soft">
              {videoDone
                ? `Watched · ${relativeTime(week.videoWatchedAt!)}`
                : "Not watched yet"}
            </div>
          </>
        ) : (
          <div className="text-sm text-ink-soft italic">
            No video uploaded yet.
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="text-sm font-medium text-ink uppercase tracking-wide">
          Week booklet
        </div>
        {week.bookletUrl ? (
          <BookletLink
            subjectWeekId={week.subjectWeekId}
            classId={classId}
            alreadyOpened={bookletDone}
          />
        ) : (
          <div className="text-sm text-ink-soft italic">
            No booklet uploaded yet.
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="text-sm font-medium text-ink uppercase tracking-wide">
          Homework due this week
        </div>
        {week.homework.length === 0 ? (
          <div className="text-sm text-ink-soft italic">
            No homework tagged to this week.
          </div>
        ) : (
          <ul className="divide-y divide-hairline/60 rounded-xl border border-hairline/60 bg-card overflow-hidden">
            {week.homework.map((h) => (
              <li key={h.homeworkId} className="px-4 py-3">
                <Link
                  href={`/student/homework/${h.homeworkId}`}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-ink truncate">{h.title}</div>
                    <div className="text-xs text-muted">
                      Due {formatDueDate(h.dueDate)}
                    </div>
                  </div>
                  <div className="text-xs uppercase tracking-wide text-ink-soft">
                    {h.score ? `${h.score}` : h.status.replace(/_/g, " ")}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-hairline/60 bg-brand-50/40 px-4 py-3 text-sm text-ink-soft">
        Progress: {videoDone ? "✓" : "○"} Video · {bookletDone ? "✓" : "○"}{" "}
        Booklet · {homeworkDone}/{week.homework.length || 0} homework
      </section>
    </div>
  );
}
