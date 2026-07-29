import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CheckCircle2, Clock, Trophy } from "lucide-react";
import { requireRole } from "@/lib/auth";
import {
  getStudentOverallSubjectRank,
  getStudentProgressSubjectDetail,
} from "../../_lib/queries";
import {
  colorFamilyForSubject,
  getAccentTokens,
} from "@/lib/subject-colors";

type Mastery = "not_started" | "needs_work" | "improving" | "strong";
type HomeworkStatus =
  | "not_started"
  | "viewed"
  | "submitted"
  | "late"
  | "marked"
  | "returned"
  | "resubmission_requested";

const MASTERY_LABEL: Record<Mastery, string> = {
  not_started: "Not started",
  needs_work: "Needs work",
  improving: "Improving",
  strong: "Strong",
};

const MASTERY_TONE: Record<
  Mastery,
  { bg: string; text: string; dot: string }
> = {
  strong: {
    bg: "var(--mint-bg)",
    text: "var(--mint)",
    dot: "var(--mint)",
  },
  improving: {
    bg: "var(--sky-bg)",
    text: "var(--sky)",
    dot: "var(--sky)",
  },
  needs_work: {
    bg: "var(--sun-100)",
    text: "var(--sun-600)",
    dot: "var(--sun-500)",
  },
  not_started: {
    bg: "var(--surface-2)",
    text: "var(--muted)",
    dot: "var(--muted-2)",
  },
};

const STATUS_LABEL: Record<HomeworkStatus, string> = {
  not_started: "Not started",
  viewed: "Viewed",
  submitted: "Submitted",
  late: "Late",
  marked: "Marked",
  returned: "Returned",
  resubmission_requested: "Resubmit",
};

const STATUS_TONE: Record<HomeworkStatus, { bg: string; text: string }> = {
  not_started: { bg: "var(--surface-2)", text: "var(--muted)" },
  viewed: { bg: "var(--surface-2)", text: "var(--ink-soft)" },
  submitted: { bg: "var(--sky-bg)", text: "var(--sky)" },
  late: { bg: "var(--sun-100)", text: "var(--sun-600)" },
  marked: { bg: "var(--mint-bg)", text: "var(--mint)" },
  returned: { bg: "var(--mint-bg)", text: "var(--mint)" },
  resubmission_requested: { bg: "var(--coral-bg)", text: "var(--coral)" },
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function StudentProgressSubjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("student");
  const { id } = await params;
  const detail = await getStudentProgressSubjectDetail(user.id, id);
  if (!detail) notFound();

  const overallRank = await getStudentOverallSubjectRank(user.id, id);
  const tokens = getAccentTokens(colorFamilyForSubject(detail.subjectName));
  const initial = detail.subjectName.charAt(0).toUpperCase();

  const marked = detail.homework.filter(
    (h) => h.score !== null && (h.status === "marked" || h.status === "returned"),
  );
  const averageScore = (() => {
    if (marked.length === 0) return null;
    const nums = marked
      .map((h) => Number(h.score))
      .filter((n) => Number.isFinite(n));
    if (nums.length === 0) return null;
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    return Math.round(avg * 10) / 10;
  })();
  const submittedCount = detail.homework.filter(
    (h) =>
      h.status === "submitted" ||
      h.status === "marked" ||
      h.status === "returned" ||
      h.status === "late",
  ).length;
  const pendingCount = detail.homework.filter(
    (h) =>
      h.status === "not_started" ||
      h.status === "viewed" ||
      h.status === "resubmission_requested",
  ).length;

  return (
    <div className="max-w-5xl space-y-6">
      <Link
        href="/student/progress"
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] font-bold text-muted hover:text-ink transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        Progress
      </Link>

      {/* Subject hero */}
      <section
        className="relative overflow-hidden rounded-[28px] px-8 py-8 text-white shadow-[0_20px_44px_-22px_rgba(31,40,90,0.5)]"
        style={{
          background: `radial-gradient(120% 140% at 0% 0%, rgba(255,255,255,0.18) 0%, transparent 50%), linear-gradient(135deg, ${tokens.arrow} 0%, ${tokens.title} 100%)`,
        }}
      >
        <div className="relative z-10 flex items-center gap-5 flex-wrap">
          <div className="h-[72px] w-[72px] rounded-[22px] grid place-items-center text-[28px] font-bold bg-white/[0.18] border border-white/30 backdrop-blur-sm shrink-0">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[0.2em] font-bold opacity-80">
              Subject progress
            </div>
            <h1 className="mt-2 text-[28px] lg:text-[34px] font-bold tracking-[-0.02em] leading-[1.05]">
              {detail.subjectName}
            </h1>
            {detail.yearLevel && (
              <div className="mt-1 text-[12px] font-semibold opacity-85">
                {detail.yearLevel}
              </div>
            )}
          </div>
          <div className="flex items-stretch gap-3 shrink-0">
            <div className="rounded-[20px] border border-white/25 bg-white/[0.14] backdrop-blur-sm px-6 py-4 text-center">
              <div className="text-[10px] uppercase tracking-[0.16em] font-bold opacity-85">
                Mastery
              </div>
              <div className="mt-1 text-[40px] font-bold tracking-[-0.02em] tabular-nums leading-none">
                {detail.masteryPercent}
                <span className="text-[22px] opacity-70">%</span>
              </div>
            </div>
            {overallRank && (
              <div className="rounded-[20px] border border-white/25 bg-white/[0.14] backdrop-blur-sm px-6 py-4 text-center">
                <div className="text-[10px] uppercase tracking-[0.16em] font-bold opacity-85 inline-flex items-center gap-1.5">
                  <Trophy className="h-3 w-3" aria-hidden />
                  Rank
                </div>
                <div className="mt-1 text-[40px] font-bold tracking-[-0.02em] tabular-nums leading-none">
                  #{overallRank.rank}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.14em] font-bold opacity-75 tabular-nums">
                  of {overallRank.total}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile
          label="Submitted"
          value={submittedCount.toString()}
          icon={<CheckCircle2 className="h-4 w-4" />}
          color="var(--mint)"
          bg="var(--mint-bg)"
        />
        <StatTile
          label="Pending"
          value={pendingCount.toString()}
          icon={<Clock className="h-4 w-4" />}
          color="var(--sun-600)"
          bg="var(--sun-100)"
        />
        <StatTile
          label="Average score"
          value={averageScore !== null ? `${averageScore}%` : "-"}
          icon={<CheckCircle2 className="h-4 w-4" />}
          color={tokens.arrow}
          bg={tokens.bgFrom}
        />
      </div>

      {/* Homework / submissions */}
      <section className="bg-surface border border-line rounded-[24px] overflow-hidden">
        <header className="px-6 py-4 border-b border-line flex items-end justify-between">
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.18em] font-bold"
              style={{ color: tokens.arrow }}
            >
              Homework & grades
            </div>
            <h2 className="mt-0.5 text-[18px] font-bold text-ink tracking-[-0.01em]">
              All tasks ({detail.homework.length})
            </h2>
          </div>
        </header>

        {detail.homework.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-[14px] text-muted">
              No homework assigned for this subject yet.
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {detail.homework.map((h) => {
              const tone = STATUS_TONE[h.status];
              const hasScore = h.score !== null;
              const dueLabel = formatDate(h.dueDate);
              const submittedLabel = h.submittedAt
                ? formatDate(h.submittedAt)
                : null;

              return (
                <li key={h.homeworkId}>
                  <Link
                    href={`/student/homework/${h.homeworkId}`}
                    className="group flex items-start gap-4 px-6 py-4 transition-colors hover:bg-surface-2/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.12em]"
                          style={{ background: tone.bg, color: tone.text }}
                        >
                          {STATUS_LABEL[h.status]}
                        </span>
                        {h.className && (
                          <span className="text-[10px] uppercase tracking-[0.12em] font-bold text-muted">
                            {h.className}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 text-[15px] font-bold text-ink leading-snug">
                        {h.title}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[12px] text-muted font-semibold">
                        <span className="tabular-nums">Due {dueLabel}</span>
                        {submittedLabel && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="tabular-nums">
                              Submitted {submittedLabel}
                            </span>
                          </>
                        )}
                      </div>
                      {h.feedback && (
                        <div className="mt-2.5 rounded-[12px] bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink-soft leading-relaxed">
                          <span
                            className="font-bold mr-1.5"
                            style={{ color: tokens.arrow }}
                          >
                            Feedback:
                          </span>
                          {h.feedback}
                        </div>
                      )}
                    </div>
                    <div
                      className="flex flex-col items-center justify-center min-w-[72px] rounded-[14px] px-3 py-2.5 shrink-0"
                      style={{
                        background: hasScore
                          ? tokens.bgFrom
                          : "var(--surface-2)",
                        color: hasScore ? tokens.arrow : "var(--muted)",
                      }}
                    >
                      <div className="text-[22px] font-bold tabular-nums leading-none tracking-[-0.02em]">
                        {hasScore ? `${Number(h.score)}` : "-"}
                      </div>
                      <div className="mt-1 text-[9px] uppercase tracking-[0.14em] font-bold">
                        {hasScore ? "score" : "ungraded"}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Topics */}
      <section className="bg-surface border border-line rounded-[24px] overflow-hidden">
        <header className="px-6 py-4 border-b border-line">
          <div
            className="text-[10px] uppercase tracking-[0.18em] font-bold"
            style={{ color: tokens.arrow }}
          >
            Topics
          </div>
          <h2 className="mt-0.5 text-[18px] font-bold text-ink tracking-[-0.01em]">
            Mastery per topic ({detail.topics.length})
          </h2>
        </header>

        <div className="px-6 py-5">
          {detail.topics.length === 0 ? (
            <div className="text-[14px] text-muted">
              Your tutor hasn&apos;t tagged any topics for this subject yet.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {detail.topics.map((t) => {
                const tone = MASTERY_TONE[t.mastery];
                return (
                  <span
                    key={t.topic}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-bold"
                    style={{ background: tone.bg, color: tone.text }}
                  >
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: tone.dot }}
                    />
                    {t.topic}
                    <span className="opacity-70 text-[10px] uppercase tracking-[0.12em]">
                      · {MASTERY_LABEL[t.mastery]}
                    </span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
  color,
  bg,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}) {
  return (
    <div
      className="rounded-[18px] p-4 flex items-center gap-3"
      style={{ background: bg }}
    >
      <div
        className="h-[36px] w-[36px] rounded-[12px] grid place-items-center shrink-0 bg-white/60"
        style={{ color }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div
          className="text-[10px] uppercase tracking-[0.14em] font-bold"
          style={{ color }}
        >
          {label}
        </div>
        <div
          className="mt-0.5 text-[22px] font-bold tabular-nums leading-none tracking-[-0.02em]"
          style={{ color }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
