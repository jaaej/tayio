import Link from "next/link";
import { Card, CardLabel } from "@/components/ui/card";
import { ProgressBar } from "@/components/data/progress-bar";
import { SubjectCard } from "@/components/data/subject-card";
import { requireRole } from "@/lib/auth";
import { StatusBadge } from "./_components/badge";
import {
  formatDueDate,
  formatTime,
  formatWeekday,
  HOMEWORK_STATUS_LABEL,
  HOMEWORK_STATUS_STYLE,
} from "./_lib/format";
import {
  getDueHomeworkCount,
  getNextLesson,
  getStudentHomework,
  getStudentSubjects,
} from "./_lib/queries";

const ACCENT_PALETTE = [
  "var(--periwinkle-500)",
  "#6b82c8",
  "#7fa0d8",
  "#a8b8e8",
  "#5e7bc7",
  "#8a9dd9",
];
function colorForSubject(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return ACCENT_PALETTE[Math.abs(hash) % ACCENT_PALETTE.length];
}

export default async function StudentDashboard() {
  const user = await requireRole("student");
  const firstName = (user.user_metadata?.first_name as string) ?? "there";

  const [subjects, nextLesson, dueCount, allHomework] = await Promise.all([
    getStudentSubjects(user.id),
    getNextLesson(user.id),
    getDueHomeworkCount(user.id),
    getStudentHomework(user.id),
  ]);

  const upcomingDue = allHomework
    .filter(
      (h) =>
        h.status === "not_started" ||
        h.status === "viewed" ||
        h.status === "resubmission_requested",
    )
    .slice(0, 5);

  const overallMastery =
    subjects.length > 0
      ? Math.round(
          subjects.reduce((acc, s) => acc + s.masteryPercent, 0) / subjects.length,
        )
      : 0;

  const today = new Date();
  const termLabel = today.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-10">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          {termLabel}
        </div>
        <h1 className="mt-2 text-4xl lg:text-5xl font-light tracking-tight text-ink">
          Hi {firstName}.
        </h1>
        <p className="mt-2 text-ink-soft">
          {dueCount === 0 && !nextLesson
            ? "All clear — nothing due, nothing on the books."
            : `${dueCount} task${dueCount === 1 ? "" : "s"} on your plate.`}
        </p>
      </header>

      <section
        className="rise grid grid-cols-2 lg:grid-cols-4 gap-3"
        style={{ animationDelay: "60ms" }}
      >
        <StatTile label="Subjects" value={subjects.length.toString()} sub="enrolled" />
        <StatTile
          label="Due"
          value={dueCount.toString()}
          sub="this week"
          tone={dueCount > 0 ? "warn" : "default"}
        />
        <StatTile
          label="Next class"
          value={
            nextLesson
              ? `${formatWeekday(nextLesson.date, "short")} ${formatTime(nextLesson.startTime)}`
              : "—"
          }
          sub={nextLesson?.subjectName ?? "Nothing scheduled"}
        />
        <StatTile
          label="Mastery"
          value={`${overallMastery}%`}
          sub="across all topics"
        />
      </section>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6">
        <section className="rise space-y-4" style={{ animationDelay: "120ms" }}>
          <div className="flex items-baseline justify-between">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
              My subjects
            </div>
            <Link
              href="/student/subjects"
              className="text-xs text-brand-700 hover:underline"
            >
              View all →
            </Link>
          </div>

          {subjects.length === 0 ? (
            <Card>
              <div className="text-sm text-ink-soft">
                You're not enrolled in any classes yet. Once your tutor adds you,
                your subjects will appear here.
              </div>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {subjects.map((s) => (
                <SubjectCard
                  key={s.classId}
                  href={`/student/subjects/${s.classId}`}
                  subject={s.subjectName}
                  meta={`${s.tutorFirstName} ${s.tutorLastName}`}
                  accent={colorForSubject(s.subjectName)}
                  badge={
                    s.dueHomeworkCount > 0
                      ? { label: `${s.dueHomeworkCount} due`, tone: "warn" }
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </section>

        <div className="space-y-4 rise" style={{ animationDelay: "200ms" }}>
          <Card>
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-base text-ink font-medium">Topic mastery</div>
              <Link
                href="/student/progress"
                className="text-xs text-brand-700 hover:underline"
              >
                Open progress
              </Link>
            </div>
            <div className="border-t border-hairline/60 -mx-6 mt-3 pt-5 px-6">
              <CardLabel>Overall</CardLabel>
              <div className="mt-1 flex items-baseline gap-3">
                <div className="text-4xl font-light text-ink tabular-nums">
                  {overallMastery}%
                </div>
                {subjects.length > 0 && (
                  <span className="text-xs text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                    across {subjects.length} subject
                    {subjects.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {subjects.slice(0, 5).map((s) => (
                <ProgressBar
                  key={s.subjectId}
                  label={s.subjectName}
                  percent={s.masteryPercent}
                  color={
                    s.masteryPercent >= 85
                      ? "bg-emerald-500"
                      : s.masteryPercent >= 60
                        ? "bg-brand-600"
                        : s.masteryPercent >= 30
                          ? "bg-amber-500"
                          : "bg-hairline"
                  }
                />
              ))}
              {subjects.length === 0 && (
                <div className="text-sm text-muted">
                  No mastery data yet — it builds up as you complete lessons and
                  quizzes.
                </div>
              )}
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="px-6 py-4 flex items-baseline justify-between border-b border-hairline/60">
              <div className="text-base text-ink font-medium">Upcoming due</div>
              <Link
                href="/student/homework"
                className="text-xs text-brand-700 hover:underline"
              >
                All homework
              </Link>
            </div>
            {upcomingDue.length === 0 ? (
              <div className="px-6 py-8 text-sm text-ink-soft">
                You're caught up — nothing to submit.
              </div>
            ) : (
              <div className="divide-y divide-hairline/60">
                {upcomingDue.map((h) => (
                  <Link
                    key={h.homeworkId}
                    href={`/student/homework/${h.homeworkId}`}
                    className="flex items-start gap-3 px-6 py-3 hover:bg-brand-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink truncate">{h.title}</div>
                      <div className="text-xs text-muted mt-0.5">
                        {h.className ?? "—"} · {formatDueDate(h.dueDate)}
                      </div>
                    </div>
                    <StatusBadge
                      label={HOMEWORK_STATUS_LABEL[h.status] ?? h.status}
                      className={HOMEWORK_STATUS_STYLE[h.status]}
                    />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "warn";
}) {
  return (
    <div
      className={
        "rounded-xl border border-hairline/50 bg-card px-4 py-3 " +
        (tone === "warn" ? "border-amber-200" : "")
      }
    >
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div className="mt-1 text-xl font-medium text-ink tabular-nums truncate">
        {value}
      </div>
      <div className="text-[11px] text-muted truncate">{sub}</div>
    </div>
  );
}
