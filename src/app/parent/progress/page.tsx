import Link from "next/link";
import { Card, CardLabel } from "@/components/ui/card";
import { MasteryBar, ProgressBar } from "@/components/data/progress-bar";
import { StatTile } from "@/components/data/stat-tile";
import { requireRole } from "@/lib/auth";
import { relativeTime } from "@/lib/format";
import {
  getChildProgressBySubject,
  getDashboardData,
  getFeedback,
  resolveSelectedChild,
} from "../_data";
import { ChildSwitcher, EmptyChildrenNotice } from "../_components/child-switcher";
import { SectionHeader } from "../_components/section-header";

const MASTERY_LABEL = {
  not_started: "Not started",
  needs_work: "Needs work",
  improving: "Improving",
  strong: "Strong",
} as const;

const MASTERY_TONE = {
  strong: "text-emerald-700 bg-emerald-50",
  improving: "text-brand-700 bg-brand-50",
  needs_work: "text-amber-800 bg-amber-50",
  not_started: "text-ink-soft bg-brand-50/40",
} as const;

type SearchParams = Promise<{ child?: string }>;

export default async function ParentProgressPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("parent");
  const { child: requested } = await searchParams;
  const { children, selected } = await resolveSelectedChild(user.id, requested);

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (!selected) {
    return (
      <div className="space-y-6">
        <Header dateLabel={dateLabel} />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const [subjects, dashboard, feedback] = await Promise.all([
    getChildProgressBySubject(selected.id),
    getDashboardData(selected.id),
    getFeedback(selected.id),
  ]);

  const allTopics = subjects.flatMap((s) => s.topics);
  const trackedSubjects = subjects.filter((s) => s.topics.length > 0);

  const overall =
    trackedSubjects.length > 0
      ? Math.round(
          trackedSubjects.reduce((acc, s) => acc + s.masteryPercent, 0) /
            trackedSubjects.length,
        )
      : 0;

  const strongCount = allTopics.filter((t) => t.mastery === "strong").length;
  const needsWorkCount = allTopics.filter(
    (t) => t.mastery === "needs_work" || t.mastery === "not_started",
  ).length;

  const homeworkRatio =
    dashboard.homeworkTotal > 0
      ? `${dashboard.homeworkCompleted}/${dashboard.homeworkTotal}`
      : "—";

  const latestFeedback = feedback[0] ?? null;

  return (
    <div className="space-y-6">
      <Header dateLabel={dateLabel} subtitle={selected.firstName} />

      {children.length > 1 && (
        <div className="rise" style={{ animationDelay: "20ms" }}>
          <ChildSwitcher
            children={children}
            selectedId={selected.id}
            basePath="/parent/progress"
          />
        </div>
      )}

      <section
        className="grid grid-cols-2 lg:grid-cols-5 gap-4 rise"
        style={{ animationDelay: "40ms" }}
      >
        <StatTile
          label="Overall mastery"
          value={`${overall}%`}
          accent={overall >= 75 ? "success" : overall >= 50 ? "brand" : "warn"}
        />
        <StatTile
          label="Topics mastered"
          value={strongCount.toString()}
          accent="success"
        />
        <StatTile
          label="Needs work"
          value={needsWorkCount.toString()}
          accent={needsWorkCount > 0 ? "warn" : "muted"}
        />
        <StatTile
          label="Attendance"
          value={
            dashboard.attendanceRate !== null
              ? `${dashboard.attendanceRate}%`
              : "—"
          }
          accent={
            dashboard.attendanceRate === null
              ? "muted"
              : dashboard.attendanceRate >= 90
                ? "success"
                : dashboard.attendanceRate >= 75
                  ? "brand"
                  : "warn"
          }
          href={`/parent/classes?child=${selected.id}`}
        />
        <StatTile
          label="Homework"
          value={homeworkRatio}
          accent={
            dashboard.homeworkTotal === 0
              ? "muted"
              : dashboard.homeworkCompleted / dashboard.homeworkTotal >= 0.9
                ? "success"
                : dashboard.homeworkCompleted / dashboard.homeworkTotal >= 0.6
                  ? "brand"
                  : "warn"
          }
          href={`/parent/homework?child=${selected.id}`}
        />
      </section>

      {subjects.length === 0 ? (
        <Card>
          <div className="py-6 text-sm text-ink-soft">
            {selected.firstName} isn't enrolled in any subjects yet. Once
            classes start, the tutor will begin tracking topics here.
          </div>
        </Card>
      ) : (
        <div
          className="grid lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] gap-5 lg:gap-6 rise"
          style={{ animationDelay: "80ms" }}
        >
          <div className="space-y-5 min-w-0">
            {subjects.map((s) => (
              <Card key={s.subjectId} className="p-0 overflow-hidden">
                <div className="px-6 py-5 border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100 flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xl font-medium text-ink truncate">
                      {s.subjectName}
                    </div>
                    {s.yearLevel && (
                      <div className="text-xs uppercase tracking-[0.16em] text-muted mt-1">
                        {s.yearLevel}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-3xl font-light text-ink tabular-nums leading-none">
                      {s.masteryPercent}%
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted mt-1">
                      {s.topics.length} topic{s.topics.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  {s.topics.length === 0 ? (
                    <div className="text-sm text-ink-soft">
                      No topics tagged yet. The tutor will add them as
                      material gets covered in class.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {s.topics.map((t) => (
                        <div
                          key={t.topic}
                          className="grid grid-cols-[1fr_auto] gap-3 items-center"
                        >
                          <MasteryBar
                            label={t.topic}
                            mastery={t.mastery}
                            className="min-w-0"
                          />
                          <span
                            className={
                              "shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] " +
                              MASTERY_TONE[t.mastery]
                            }
                          >
                            {MASTERY_LABEL[t.mastery]}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <aside className="space-y-5 min-w-0 lg:sticky lg:top-6 lg:self-start">
            <Card className="p-0 overflow-hidden">
              <SectionHeader title="Overall" />
              <div className="p-5">
                <CardLabel>Across all subjects</CardLabel>
                <div className="mt-1 flex items-baseline gap-2">
                  <div className="text-6xl font-light text-ink tabular-nums">
                    {overall}%
                  </div>
                </div>
                <div className="mt-5 space-y-3.5">
                  {subjects.map((s) => (
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
                </div>
              </div>
            </Card>

            {latestFeedback && (
              <Card className="p-0 overflow-hidden">
                <SectionHeader
                  title="Latest From The Tutor"
                  link={{ href: "/parent/feedback", label: "All notes" }}
                />
                <div className="px-6 py-5">
                  <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-muted">
                    <span className="truncate">
                      {latestFeedback.subjectName ?? "Lesson"} ·{" "}
                      {latestFeedback.tutorName}
                    </span>
                    <span className="shrink-0">
                      {relativeTime(latestFeedback.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-base text-ink-soft leading-relaxed">
                    {latestFeedback.parentVisibleComment}
                  </p>
                </div>
              </Card>
            )}

            <Card className="p-0 overflow-hidden">
              <SectionHeader title="Focus Areas" />
              {needsWorkCount === 0 ? (
                <div className="px-6 py-8 text-sm text-ink-soft">
                  No weak topics right now — {selected.firstName} is keeping
                  pace.
                </div>
              ) : (
                <ul className="divide-y divide-hairline/60">
                  {subjects.flatMap((s) =>
                    s.topics
                      .filter(
                        (t) =>
                          t.mastery === "needs_work" ||
                          t.mastery === "not_started",
                      )
                      .slice(0, 6)
                      .map((t) => (
                        <li
                          key={`${s.subjectId}-${t.topic}`}
                          className="px-5 py-3"
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="text-sm text-ink truncate">
                              {t.topic}
                            </div>
                            <span
                              className={
                                "shrink-0 text-[10px] uppercase tracking-[0.14em] " +
                                (t.mastery === "needs_work"
                                  ? "text-amber-800"
                                  : "text-ink-soft")
                              }
                            >
                              {MASTERY_LABEL[t.mastery]}
                            </span>
                          </div>
                          <div className="text-xs text-muted mt-0.5 truncate">
                            {s.subjectName}
                          </div>
                        </li>
                      )),
                  )}
                </ul>
              )}
            </Card>

          </aside>
        </div>
      )}
    </div>
  );
}

function Header({ dateLabel, subtitle }: { dateLabel: string; subtitle?: string }) {
  return (
    <header className="rise">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600 animate-pulse" />
        {dateLabel}
      </div>
      <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
        {subtitle ? `${subtitle}'s Progress` : "Progress"}
      </h1>
    </header>
  );
}
