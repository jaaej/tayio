import Link from "next/link";
import { Card, CardLabel } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { StatusBadge } from "../_components/badge";
import {
  formatDateLong,
  formatTime,
  LESSON_STATUS_LABEL,
  LESSON_STATUS_STYLE,
} from "../_lib/format";
import { getStudentLessonsWithNotes } from "../_lib/queries";

export default async function LessonsIndexPage() {
  const user = await requireRole("student");
  const lessons = await getStudentLessonsWithNotes(user.id);

  return (
    <div className="space-y-10">
      <header className="rise">
        <CardLabel>Lessons</CardLabel>
        <h1 className="mt-2 text-4xl lg:text-5xl font-light tracking-tight text-ink">
          Recent lessons
        </h1>
        <p className="mt-3 text-ink-soft max-w-xl">
          Open any past lesson to read the recap your tutor wrote.
        </p>
      </header>

      <Card className="p-0 overflow-hidden">
        {lessons.length === 0 ? (
          <div className="px-6 py-8 text-sm text-ink-soft">
            No lessons yet.
          </div>
        ) : (
          <ul className="divide-y divide-hairline">
            {lessons.map((l) => (
              <li key={l.lessonId}>
                <Link
                  href={`/student/lessons/${l.lessonId}`}
                  className="grid grid-cols-1 md:grid-cols-[12rem_1fr_auto_auto] gap-3 md:gap-6 px-6 py-4 items-baseline hover:bg-brand-50/60 transition-colors"
                >
                  <div>
                    <div className="text-sm text-ink">{formatDateLong(l.date)}</div>
                    <div className="text-xs text-muted">
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
                  <div className="md:justify-self-end text-xs text-brand-700">
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
