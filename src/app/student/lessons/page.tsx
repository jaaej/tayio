import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/data/stat-tile";
import { StatusBadge } from "@/components/data/status-badge";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatTime } from "@/lib/format";
import { LESSON_STATUS_LABEL, LESSON_STATUS_STYLE } from "@/lib/status";
import { getStudentLessonsWithNotes } from "../_lib/queries";
import { SectionHeader } from "../_components/section-header";

export default async function LessonsIndexPage() {
  const user = await requireRole("student");
  const lessons = await getStudentLessonsWithNotes(user.id);

  const withRecap = lessons.filter((l) => l.hasNote).length;
  const completed = lessons.filter((l) => l.status === "completed").length;
  const upcoming = lessons.filter((l) => l.status === "upcoming").length;

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between rise">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600 animate-pulse" />
            {dateLabel}
          </div>
          <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink">
            Lessons
          </h1>
        </div>
      </header>

      <section
        className="grid grid-cols-3 gap-4 rise"
        style={{ animationDelay: "40ms" } as React.CSSProperties}
      >
        <StatTile
          label="Recaps available"
          value={withRecap.toString()}
          accent={withRecap > 0 ? "brand" : "muted"}
        />
        <StatTile
          label="Completed"
          value={completed.toString()}
          accent="success"
        />
        <StatTile
          label="Upcoming"
          value={upcoming.toString()}
          accent="brand"
          href="/student/timetable"
        />
      </section>

      <Card
        className="p-0 overflow-hidden rise"
        style={{ animationDelay: "80ms" } as React.CSSProperties}
      >
        <SectionHeader title="Recent lessons" right={`${lessons.length} total`} />
        {lessons.length === 0 ? (
          <div className="px-6 py-8 text-sm text-ink-soft">No lessons yet.</div>
        ) : (
          <ul className="divide-y divide-hairline/60">
            {lessons.map((l) => (
              <li key={l.lessonId}>
                <Link
                  href={`/student/lessons/${l.lessonId}`}
                  className="grid grid-cols-1 md:grid-cols-[12rem_1fr_auto_auto] gap-3 md:gap-6 px-6 py-4 items-baseline hover:bg-brand-50/60 transition-colors"
                >
                  <div>
                    <div className="text-sm text-ink">
                      {formatDateLong(l.date)}
                    </div>
                    <div className="text-xs text-muted tabular-nums">
                      {formatTime(l.startTime)}
                    </div>
                  </div>
                  <div className="text-sm text-ink-soft">
                    {l.subjectName}
                    <span className="text-muted"> · {l.className}</span>
                  </div>
                  <div className="md:justify-self-end">
                    <StatusBadge
                      label={LESSON_STATUS_LABEL[l.status] ?? l.status}
                      className={LESSON_STATUS_STYLE[l.status]}
                    />
                  </div>
                  <div
                    className={
                      "md:justify-self-end text-xs " +
                      (l.hasNote ? "text-brand-700" : "text-muted")
                    }
                  >
                    {l.hasNote ? "Recap ready →" : "No recap yet"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
