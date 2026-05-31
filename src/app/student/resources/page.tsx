import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/data/status-badge";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatTime } from "@/lib/format";
import { LESSON_STATUS_LABEL, LESSON_STATUS_STYLE } from "@/lib/status";
import { getStudentLessonsWithNotes } from "../_lib/queries";
import { SectionHeader } from "../_components/section-header";

export default async function ResourcesIndexPage() {
  const user = await requireRole("student");
  const lessons = await getStudentLessonsWithNotes(user.id);

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
          <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
            Resources
          </h1>
        </div>
      </header>

      <Card
        className="p-0 overflow-hidden rise"
        style={{ animationDelay: "80ms" } as React.CSSProperties}
      >
        <SectionHeader title="Recorded Lessons" right={`${lessons.length} total`} />
        {lessons.length === 0 ? (
          <div className="px-6 py-8 text-sm text-ink-soft">No lessons yet.</div>
        ) : (
          <ul className="divide-y divide-hairline/60">
            {lessons.map((l) => (
              <li key={l.lessonId}>
                <Link
                  href={`/student/resources/${l.lessonId}`}
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
