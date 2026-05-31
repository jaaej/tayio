import { signCurriculumUrl } from "@/lib/curriculum-storage";
import { formatDueDate, relativeTime } from "@/lib/format";
import type { ParentCurriculumWeek } from "../_queries";

export async function WeekContentParent({
  week,
}: {
  week: ParentCurriculumWeek;
}) {
  const videoSignedUrl = await signCurriculumUrl(week.videoUrl);
  const bookletSignedUrl = await signCurriculumUrl(week.bookletUrl);
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
            <video controls className="w-full rounded-xl bg-black">
              <source src={videoSignedUrl} />
            </video>
            <div className="text-xs text-ink-soft">
              Child status:{" "}
              {videoDone
                ? `watched · ${relativeTime(week.videoWatchedAt!)}`
                : "not watched"}
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
        {bookletSignedUrl ? (
          <a
            href={bookletSignedUrl}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-lg border border-hairline/60 bg-card px-4 py-2 text-sm font-medium hover:bg-brand-50"
          >
            Open PDF →
          </a>
        ) : (
          <div className="text-sm text-ink-soft italic">
            No booklet uploaded yet.
          </div>
        )}
        <div className="text-xs text-ink-soft">
          Child status: {bookletDone ? "opened" : "not opened"}
        </div>
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
              <li
                key={h.homeworkId}
                className="px-4 py-3 flex items-center justify-between gap-3"
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
