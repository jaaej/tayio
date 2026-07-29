import Link from "next/link";
import { Sparkles, Target, TrendingUp, Trophy } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getStudentProgressBySubject } from "../_lib/queries";
import {
  colorFamilyForSubject,
  getAccentTokens,
} from "@/lib/subject-colors";

type Mastery = "not_started" | "needs_work" | "improving" | "strong";

const MASTERY_LABEL: Record<Mastery, string> = {
  not_started: "Not started",
  needs_work: "Needs work",
  improving: "Improving",
  strong: "Strong",
};

const MASTERY_TONE: Record<Mastery, { bg: string; text: string; dot: string }> =
  {
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

export default async function ProgressPage() {
  const user = await requireRole("student");
  const subjects = await getStudentProgressBySubject(user.id);

  const allTopics = subjects.flatMap((s) =>
    s.topics.map((t) => ({ ...t, subjectName: s.subjectName, subjectId: s.subjectId })),
  );
  const trackedSubjects = subjects.filter((s) => s.topics.length > 0);

  const overall =
    trackedSubjects.length > 0
      ? Math.round(
          trackedSubjects.reduce((acc, s) => acc + s.masteryPercent, 0) /
            trackedSubjects.length,
        )
      : 0;

  const strongCount = allTopics.filter((t) => t.mastery === "strong").length;
  const improvingCount = allTopics.filter((t) => t.mastery === "improving").length;
  const needsWorkCount = allTopics.filter(
    (t) => t.mastery === "needs_work" || t.mastery === "not_started",
  ).length;

  const focusList = allTopics
    .filter((t) => t.mastery === "needs_work" || t.mastery === "not_started")
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Indigo gradient hero with overall mastery */}
      <section
        className="relative overflow-hidden rounded-[28px] px-7 py-7 text-white shadow-[0_20px_44px_-22px_rgba(50,58,145,0.6)]"
        style={{
          background:
            "radial-gradient(120% 140% at 0% 0%, #A0BFFC 0%, transparent 45%), radial-gradient(110% 150% at 100% 10%, #7A9BF5 0%, transparent 52%), linear-gradient(125deg, #4F5BD5 0%, #3F4AB5 58%, #2B3287 100%)",
        }}
      >
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          className="absolute -right-8 -top-10 w-[240px] h-[240px] opacity-50 pointer-events-none"
          fill="none"
        >
          <circle cx="70" cy="30" r="30" fill="rgba(255,255,255,0.10)" />
          <circle cx="70" cy="30" r="20" fill="rgba(255,255,255,0.10)" />
          <circle cx="70" cy="30" r="10" fill="rgba(255,255,255,0.12)" />
        </svg>

        <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.2em] font-bold opacity-80">
              Progress
            </div>
            <h1 className="mt-1.5 text-[28px] lg:text-[32px] font-extrabold tracking-[-0.02em] leading-tight">
              Your mastery
            </h1>
            <p className="mt-2 text-[13px] opacity-85">
              {allTopics.length} topic{allTopics.length === 1 ? "" : "s"} tracked
              across {trackedSubjects.length} subject
              {trackedSubjects.length === 1 ? "" : "s"}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MasteryChip
                label={`${strongCount} mastered`}
                icon={<Trophy className="h-3 w-3" />}
              />
              <MasteryChip
                label={`${improvingCount} improving`}
                icon={<TrendingUp className="h-3 w-3" />}
              />
              <MasteryChip
                label={`${needsWorkCount} to focus`}
                icon={<Target className="h-3 w-3" />}
              />
            </div>
          </div>

          {/* Big mastery number tile */}
          <div className="rounded-[24px] border border-white/25 bg-white/[0.14] backdrop-blur-sm px-7 py-5 text-center shrink-0">
            <div className="text-[11px] uppercase tracking-[0.16em] font-bold opacity-85">
              Overall
            </div>
            <div className="mt-1 text-[56px] font-extrabold tracking-[-0.03em] tabular-nums leading-none">
              {overall}
              <span className="text-[28px] align-top opacity-80">%</span>
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.14em] font-bold opacity-75">
              Across all subjects
            </div>
          </div>
        </div>
      </section>

      {subjects.length === 0 ? (
        <div className="rounded-[22px] border border-line bg-surface p-10 text-center space-y-2">
          <div className="inline-flex items-center justify-center h-[56px] w-[56px] rounded-[18px] bg-brand-50 text-brand-600">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="text-[15px] font-extrabold text-ink">
            No subjects yet
          </div>
          <div className="text-[13px] text-ink-soft max-w-[320px] mx-auto">
            Once you have classes, your tutor will start tracking topics here.
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
          {/* MAIN: subject mastery cards */}
          <div className="space-y-4 min-w-0">
            {subjects.map((s) => {
              const tokens = getAccentTokens(colorFamilyForSubject(s.subjectName));
              const initial = s.subjectName.charAt(0).toUpperCase();
              return (
                <Link
                  key={s.subjectId}
                  href={`/student/progress/${s.subjectId}`}
                  className="group relative block bg-surface border border-line rounded-[22px] overflow-hidden transition-all duration-150 hover:-translate-y-[2px] hover:border-line-strong hover:shadow-[0_18px_38px_-22px_rgba(31,40,90,0.25)]"
                >
                  <div
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-1.5"
                    style={{ background: tokens.arrow }}
                  />
                  <div className="p-5 pt-6">
                    <div className="flex items-center gap-4">
                      <div
                        className="h-[52px] w-[52px] rounded-[15px] grid place-items-center text-[22px] font-extrabold shrink-0"
                        style={{
                          background: tokens.bgFrom,
                          color: tokens.arrow,
                        }}
                      >
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-muted">
                          Subject
                        </div>
                        <div
                          className="mt-0.5 text-[18px] font-extrabold leading-tight tracking-[-0.01em]"
                          style={{ color: tokens.title }}
                        >
                          {s.subjectName}
                        </div>
                        <div className="text-[11px] text-muted mt-0.5 font-semibold">
                          {s.topics.length} topic
                          {s.topics.length === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div
                        className="text-[32px] font-extrabold tabular-nums tracking-[-0.02em] leading-none shrink-0"
                        style={{ color: tokens.arrow }}
                      >
                        {s.masteryPercent}
                        <span className="text-[18px] opacity-70">%</span>
                      </div>
                    </div>

                    {/* Mastery bar */}
                    <div className="mt-4">
                      <div
                        className="h-2 w-full rounded-full overflow-hidden"
                        style={{ background: tokens.bgFrom }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${s.masteryPercent}%`,
                            background: tokens.arrow,
                          }}
                        />
                      </div>
                    </div>

                    {/* Topic chips */}
                    {s.topics.length === 0 ? (
                      <div className="mt-4 text-[13px] text-ink-soft">
                        No topics tagged yet. Your tutor will add them as you
                        cover material in class.
                      </div>
                    ) : (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {s.topics.map((t) => {
                          const tone = MASTERY_TONE[t.mastery];
                          return (
                            <span
                              key={t.topic}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-extrabold"
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
                </Link>
              );
            })}
          </div>

          {/* SIDEBAR */}
          <aside className="space-y-4 min-w-0 lg:sticky lg:top-6 lg:self-start">
            {/* Focus next - sun-themed card */}
            <section
              className="relative overflow-hidden rounded-[22px] border border-sun-200 p-5"
              style={{ background: "var(--sun-50)" }}
            >
              <div
                aria-hidden
                className="absolute -right-8 -top-10 w-[140px] h-[140px] rounded-full opacity-50 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle, var(--sun-200), transparent 70%)",
                }}
              />
              <div className="relative flex items-center gap-3 mb-3">
                <div
                  className="h-[40px] w-[40px] rounded-[13px] grid place-items-center"
                  style={{
                    background: "var(--sun-100)",
                    color: "var(--sun-600)",
                  }}
                >
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-sun-600">
                    Focus next
                  </div>
                  <div className="text-[15px] font-extrabold text-ink leading-tight">
                    Weak topics
                  </div>
                </div>
              </div>
              {focusList.length === 0 ? (
                <div className="relative text-[13px] text-ink-soft py-2">
                  No weak topics right now - keep it up.
                </div>
              ) : (
                <ul className="relative space-y-2">
                  {focusList.map((t) => {
                    const tone = MASTERY_TONE[t.mastery];
                    return (
                      <li
                        key={`${t.subjectId}-${t.topic}`}
                        className="flex items-start gap-3 p-3 rounded-[14px] bg-white/70 backdrop-blur-sm"
                      >
                        <span
                          aria-hidden
                          className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                          style={{ background: tone.dot }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-extrabold text-ink leading-tight">
                            {t.topic}
                          </div>
                          <div className="text-[11px] text-muted mt-0.5 font-semibold truncate">
                            {t.subjectName}
                          </div>
                        </div>
                        <span
                          className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] uppercase tracking-[0.12em] font-extrabold"
                          style={{ background: tone.bg, color: tone.text }}
                        >
                          {MASTERY_LABEL[t.mastery]}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

          </aside>
        </div>
      )}
    </div>
  );
}

function MasteryChip({
  label,
  icon,
}: {
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-white/[0.18] border border-white/25 px-2.5 py-1 rounded-full text-[11px] font-extrabold tabular-nums">
      {icon}
      {label}
    </span>
  );
}
