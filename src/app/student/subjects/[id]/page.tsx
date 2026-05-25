import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardLabel } from "@/components/ui/card";
import { MasteryBar, ProgressBar } from "@/components/data/progress-bar";
import { requireRole } from "@/lib/auth";
import { StatusBadge } from "../../_components/badge";
import {
  formatDateLong,
  formatDueDate,
  formatTime,
  HOMEWORK_STATUS_LABEL,
  HOMEWORK_STATUS_STYLE,
  LESSON_STATUS_LABEL,
  LESSON_STATUS_STYLE,
} from "../../_lib/format";
import { getSubjectDetail } from "../../_lib/queries";

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function SubjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("student");
  const { id } = await params;
  const detail = await getSubjectDetail(user.id, id);
  if (!detail) notFound();

  const scheduleLine = [
    detail.weekday !== null ? WEEKDAY[detail.weekday] : null,
    detail.startTime && detail.endTime
      ? `${formatTime(detail.startTime)} – ${formatTime(detail.endTime)}`
      : null,
    detail.location,
  ]
    .filter(Boolean)
    .join(" · ");

  const dueHomework = detail.homework.filter(
    (h) =>
      h.status === "not_started" ||
      h.status === "viewed" ||
      h.status === "resubmission_requested",
  );
  const completedLessons = detail.lessons.filter((l) => l.status === "completed");
  const upcomingLessons = detail.lessons.filter((l) => l.status === "upcoming");

  return (
    <div className="space-y-10">
      <header className="rise space-y-3">
        <Link
          href="/student/subjects"
          className="text-[11px] uppercase tracking-[0.2em] text-muted hover:text-ink"
        >
          ← All subjects
        </Link>
        <h1 className="text-4xl lg:text-5xl font-light tracking-tight text-ink">
          {detail.subjectName}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
          <span>{detail.className}</span>
          <span className="text-hairline">·</span>
          <span>
            {detail.tutorFirstName} {detail.tutorLastName}
          </span>
          {scheduleLine && (
            <>
              <span className="text-hairline">·</span>
              <span>{scheduleLine}</span>
            </>
          )}
        </div>
      </header>

      {/* Stats strip */}
      <section
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 rise"
        style={{ animationDelay: "60ms" }}
      >
        <Stat label="Mastery" value={`${detail.masteryPercent}%`} sub="topics tracked" />
        <Stat label="Lessons" value={completedLessons.length.toString()} sub="completed" />
        <Stat
          label="Upcoming"
          value={upcomingLessons.length.toString()}
          sub="on the schedule"
        />
        <Stat
          label="Due"
          value={dueHomework.length.toString()}
          sub="homework"
          tone={dueHomework.length > 0 ? "warn" : "default"}
        />
      </section>

      {/* Two-column body */}
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        {/* Left: lessons + homework */}
        <div className="space-y-6">
          <Section
            title="Homework"
            link={{ href: "/student/homework", label: "All homework" }}
          >
            {detail.homework.length === 0 ? (
              <Empty>No homework yet for this subject.</Empty>
            ) : (
              <div className="divide-y divide-hairline/60">
                {detail.homework.map((h) => (
                  <Link
                    key={h.homeworkId}
                    href={`/student/homework/${h.homeworkId}`}
                    className="flex items-start gap-3 px-6 py-3 hover:bg-brand-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink truncate">{h.title}</div>
                      <div className="text-xs text-muted mt-0.5">
                        Due {formatDueDate(h.dueDate)}
                        {h.score ? ` · scored ${h.score}` : ""}
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
          </Section>

          <Section
            title="Lessons"
            link={{ href: "/student/lessons", label: "All lessons" }}
          >
            {detail.lessons.length === 0 ? (
              <Empty>No lessons recorded yet.</Empty>
            ) : (
              <div className="divide-y divide-hairline/60">
                {detail.lessons.map((l) => (
                  <Link
                    key={l.id}
                    href={
                      l.hasNote
                        ? `/student/lessons/${l.id}`
                        : "/student/lessons"
                    }
                    className="flex items-baseline gap-4 px-6 py-3 hover:bg-brand-50 transition-colors"
                  >
                    <div className="text-xs text-muted w-28 shrink-0">
                      {formatDateLong(l.date)}
                    </div>
                    <div className="text-sm text-ink-soft w-28 shrink-0">
                      {formatTime(l.startTime)} – {formatTime(l.endTime)}
                    </div>
                    <div className="flex-1 flex items-center gap-3 justify-end">
                      <StatusBadge
                        label={LESSON_STATUS_LABEL[l.status] ?? l.status}
                        className={LESSON_STATUS_STYLE[l.status]}
                      />
                      {l.hasNote && (
                        <span className="text-[11px] text-brand-700">
                          recap →
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Right: progress + materials */}
        <div className="space-y-6">
          <Card>
            <div className="flex items-baseline justify-between mb-3">
              <div className="text-base text-ink font-medium">Progress</div>
              <Link
                href="/student/progress"
                className="text-xs text-brand-700 hover:underline"
              >
                Open progress
              </Link>
            </div>
            <CardLabel>Topic mastery</CardLabel>
            <div className="mt-1 flex items-baseline gap-3">
              <div className="text-4xl font-light text-ink tabular-nums">
                {detail.masteryPercent}%
              </div>
              {detail.topics.length > 0 && (
                <span className="text-xs text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                  {detail.topics.length} topic{detail.topics.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="mt-6 space-y-4">
              {detail.topics.length === 0 ? (
                <div className="text-sm text-muted">
                  No topic data yet. It'll appear once your tutor tags topics in
                  lesson notes.
                </div>
              ) : (
                detail.topics.map((t) => (
                  <MasteryBar
                    key={t.topic}
                    label={t.topic}
                    mastery={t.mastery}
                  />
                ))
              )}
            </div>
          </Card>

          <Card>
            <div className="text-base text-ink font-medium">Class materials</div>
            <div className="mt-4 text-sm text-ink-soft">
              Linked worksheets, slides, and past papers for {detail.subjectName}{" "}
              will appear here once your tutor uploads them.
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Pill>Worksheets</Pill>
              <Pill>Notes</Pill>
              <Pill>Past papers</Pill>
              <Pill>Quizzes</Pill>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  link,
  children,
}: {
  title: string;
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-6 py-4 flex items-baseline justify-between border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100">
        <div className="text-base text-ink font-medium">{title}</div>
        {link && (
          <Link href={link.href} className="text-xs text-brand-700 hover:underline">
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-8 text-sm text-ink-soft">{children}</div>;
}

function Stat({
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
      <div className="mt-1 text-xl font-medium text-ink tabular-nums">{value}</div>
      <div className="text-[11px] text-muted">{sub}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-brand-50 text-brand-700 border border-brand-200/50">
      {children}
    </span>
  );
}
