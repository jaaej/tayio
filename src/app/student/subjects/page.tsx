import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { SubjectCard } from "@/components/student/subject-card";
import { HomeworkRow } from "@/components/student/homework-row";
import {
  Card,
  CardHead,
  CardBody,
} from "@/components/student/card";
import { Badge } from "@/components/student/pill";
import { PageHead, SectionHead } from "@/components/student/page-head";
import { formatDueDate, relativeTime } from "@/lib/format";
import {
  colorFamilyForSubject,
  getAccentTokens,
} from "@/lib/subject-colors";
import {
  getStudentHomework,
  getStudentProgressBySubject,
  getStudentSubjects,
  type HomeworkRow as HomeworkRowData,
} from "../_lib/queries";

const MASTERY_LABEL = {
  not_started: "Not started",
  needs_work:  "Needs work",
  improving:   "Improving",
  strong:      "Strong",
} as const;

export default async function StudentSubjectsIndex() {
  const user = await requireRole("student");
  const [subjects, progress, allHomework] = await Promise.all([
    getStudentSubjects(user.id),
    getStudentProgressBySubject(user.id),
    getStudentHomework(user.id),
  ]);

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const weekAhead = new Date(startOfToday);
  weekAhead.setDate(startOfToday.getDate() + 7);

  // Bucket homework. Open items split by due date; completed items split by
  // submitted-vs-marked. Matches the buckets the old standalone homework page used.
  const openStatuses = new Set([
    "not_started",
    "viewed",
    "resubmission_requested",
    "late",
  ]);
  const open = allHomework.filter((h) => openStatuses.has(h.status));
  const overdue = open
    .filter((h) => h.dueDate < startOfToday || h.status === "late")
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const dueSoon = open
    .filter(
      (h) =>
        h.status !== "late" &&
        h.dueDate >= startOfToday &&
        h.dueDate < weekAhead,
    )
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const dueLater = open
    .filter((h) => h.status !== "late" && h.dueDate >= weekAhead)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const submitted = allHomework
    .filter((h) => h.status === "submitted")
    .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());
  const marked = allHomework
    .filter((h) => h.status === "marked" || h.status === "returned")
    .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());

  // Weak topics — kept as the right-rail card
  const allTopics = progress.flatMap((s) =>
    s.topics.map((t) => ({ ...t, subjectName: s.subjectName, subjectId: s.subjectId })),
  );
  const focusTop = allTopics
    .filter((t) => t.mastery === "needs_work" || t.mastery === "not_started")
    .sort((a, b) => (a.mastery === "needs_work" ? -1 : 1))
    .slice(0, 6);
  const weakCount = allTopics.filter(
    (t) => t.mastery === "needs_work" || t.mastery === "not_started",
  ).length;

  // De-duped tutors
  const tutorRows = (() => {
    const seen = new Map<string, { name: string; subjects: string[] }>();
    for (const s of subjects) {
      const name = `${s.tutorFirstName} ${s.tutorLastName}`.trim();
      const key = name || "Unassigned";
      const row = seen.get(key) ?? { name: key, subjects: [] };
      if (!row.subjects.includes(s.subjectName)) row.subjects.push(s.subjectName);
      seen.set(key, row);
    }
    return Array.from(seen.values());
  })();

  if (subjects.length === 0) {
    return (
      <div className="space-y-5">
        <PageHead
          eyebrow="My subjects"
          title="Your subjects"
          sub="Tap a subject to see class materials, lessons, homework, and progress."
        />
        <Card>
          <CardBody>
            <div className="text-[13px] text-muted">
              You're not enrolled in any classes yet.
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="My subjects"
        title="Your subjects"
        sub={`${subjects.length} subject${subjects.length === 1 ? "" : "s"} · ${open.length} homework open`}
      />

      {/* Main grid */}
      <div className="grid lg:grid-cols-[2fr_1fr] gap-5 items-start">
        {/* LEFT */}
        <div className="space-y-5 min-w-0">
          {/* Subject grid */}
          <div>
            <SectionHead
              title="All subjects"
              actionHref="/student/progress"
              actionLabel="View progress →"
            />
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {subjects.map((s) => (
                <SubjectCard
                  key={s.classId}
                  href={`/student/subjects/${s.subjectId}`}
                  name={s.subjectName}
                  mastery={s.masteryPercent}
                  nextLabel={
                    s.tutorFirstName
                      ? `${s.tutorFirstName} ${s.tutorLastName ?? ""}`.trim()
                      : undefined
                  }
                />
              ))}
            </div>
          </div>

          {/* Homework — overall list, bucketed */}
          <div>
            <SectionHead title="Homework" />
            {allHomework.length === 0 ? (
              <Card>
                <CardBody>
                  <div className="text-sm text-muted text-center py-2">
                    No homework assigned yet.
                  </div>
                </CardBody>
              </Card>
            ) : (
              <div className="space-y-3">
                {overdue.length > 0 && (
                  <Card className="overflow-hidden">
                    <CardHead
                      title="Overdue"
                      action={
                        <span className="text-bad">
                          {overdue.length} item{overdue.length === 1 ? "" : "s"}
                        </span>
                      }
                    />
                    <HomeworkList items={overdue} />
                  </Card>
                )}
                {dueSoon.length > 0 && (
                  <Card className="overflow-hidden">
                    <CardHead
                      title="Due this week"
                      action={`${dueSoon.length} item${dueSoon.length === 1 ? "" : "s"}`}
                    />
                    <HomeworkList items={dueSoon} />
                  </Card>
                )}
                {dueLater.length > 0 && (
                  <Card className="overflow-hidden">
                    <CardHead
                      title="Coming up"
                      action={`${dueLater.length} item${dueLater.length === 1 ? "" : "s"}`}
                    />
                    <HomeworkList items={dueLater} />
                  </Card>
                )}
                {submitted.length > 0 && (
                  <Card className="overflow-hidden">
                    <CardHead
                      title="Submitted"
                      action={`${submitted.length} item${submitted.length === 1 ? "" : "s"}`}
                    />
                    <HomeworkList items={submitted} />
                  </Card>
                )}
                {marked.length > 0 && (
                  <Card className="overflow-hidden">
                    <CardHead
                      title="Marked"
                      action={`${marked.length} item${marked.length === 1 ? "" : "s"}`}
                    />
                    <HomeworkList items={marked} />
                  </Card>
                )}
                {open.length === 0 && submitted.length === 0 && marked.length === 0 && (
                  <Card>
                    <CardBody>
                      <div className="text-sm text-muted text-center py-2">
                        You're caught up — nothing to submit.
                      </div>
                    </CardBody>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-5 min-w-0">
          {/* Focus next */}
          <Card>
            <CardHead
              title="Focus next"
              action={`${weakCount} topic${weakCount === 1 ? "" : "s"}`}
            />
            <CardBody tight>
              {focusTop.length === 0 ? (
                <div className="px-4 py-6 text-[13px] text-muted text-center">
                  No weak topics — keep it up.
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {focusTop.map((t) => (
                    <li
                      key={`${t.subjectId}-${t.topic}`}
                      className="px-4 py-3"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="text-[13px] font-semibold text-ink truncate">
                          {t.topic}
                        </div>
                        <span
                          className={
                            "shrink-0 text-[10px] uppercase tracking-[0.12em] font-bold " +
                            (t.mastery === "needs_work"
                              ? "text-warn"
                              : "text-muted")
                          }
                        >
                          {MASTERY_LABEL[t.mastery]}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted mt-0.5 truncate">
                        {t.subjectName}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Your tutors */}
          <Card>
            <CardHead title="Your tutors" />
            <CardBody tight>
              <ul className="divide-y divide-line">
                {tutorRows.map((t) => {
                  const initials = t.name
                    .split(/\s+/)
                    .map((p) => p.charAt(0))
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  return (
                    <li
                      key={t.name}
                      className="px-4 py-3 flex items-center gap-3"
                    >
                      <div className="h-9 w-9 rounded-full bg-brand-500 text-white grid place-items-center text-[12px] font-bold shrink-0">
                        {initials || "T"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold text-ink truncate">
                          {t.name}
                        </div>
                        <div className="text-[11px] text-muted truncate mt-0.5">
                          {t.subjects.join(" · ")}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function HomeworkList({ items }: { items: HomeworkRowData[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((h) => (
        <li key={h.homeworkId}>
          <HomeworkRow
            title={h.title}
            subject={h.className ?? "Homework"}
            meta={`due ${formatDueDate(h.dueDate)}`}
            href={`/student/homework/${h.homeworkId}`}
          />
        </li>
      ))}
    </ul>
  );
}
