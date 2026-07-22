import { FileText, Link2 as LinkIcon } from "lucide-react";
import { signCurriculumUrl } from "@/lib/curriculum-storage";
import { formatDueDate, relativeTime } from "@/lib/format";
import { httpHref } from "@/lib/safe-url";
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
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
          Week {week.weekNumber}
        </div>
        <h2 className="text-2xl font-extrabold tracking-[-0.01em] text-ink">
          {week.title}
        </h2>
      </header>

      {/* OVERVIEW — what this week covers */}
      {week.description && (
        <section className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
            Overview
          </div>
          <div className="rounded-xl border border-line bg-surface p-4 text-sm text-ink leading-relaxed whitespace-pre-wrap">
            {week.description}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
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
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
          Week booklet
        </div>
        {bookletSignedUrl ? (
          <a
            href={bookletSignedUrl}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-brand-50"
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

      {/* TUTOR NOTES — extra material the tutor added for this week */}
      {(week.tutorNote || week.tutorAttachments.length > 0) && (
        <section className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
            Tutor notes
          </div>
          <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
            {week.tutorNote && (
              <div className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap">
                {week.tutorNote}
              </div>
            )}
            {week.tutorAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {week.tutorAttachments.map((att) => {
                  const Icon = att.kind === "link" ? LinkIcon : FileText;
                  const href = httpHref(att.url);
                  return href ? (
                    <a
                      key={att.id}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-background px-3 py-2 text-[12px] font-semibold text-ink hover:bg-brand-50 transition-colors"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted" />
                      {att.fileName}
                    </a>
                  ) : (
                    <span
                      key={att.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-background px-3 py-2 text-[12px] font-semibold text-muted"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {att.fileName}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
          Homework due this week
        </div>
        {week.homework.length === 0 ? (
          <div className="text-sm text-ink-soft italic">
            No homework tagged to this week.
          </div>
        ) : (
          <ul className="divide-y divide-line/70 rounded-xl border border-line bg-surface overflow-hidden">
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

      <section className="rounded-xl border border-line bg-brand-50/40 px-4 py-3 text-sm text-ink-soft">
        Progress: {videoDone ? "✓" : "○"} Video · {bookletDone ? "✓" : "○"}{" "}
        Booklet · {homeworkDone}/{week.homework.length || 0} homework
      </section>
    </div>
  );
}

