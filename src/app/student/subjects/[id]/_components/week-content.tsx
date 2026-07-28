import Link from "next/link";
import {
  PlayCircle,
  BookOpen,
  FileText,
  Check,
  AlertCircle,
  Link2 as LinkIcon,
  ListChecks,
  ArrowRight,
} from "lucide-react";
import { signCurriculumUrl } from "@/lib/curriculum-storage";
import { formatDueDate, relativeTime } from "@/lib/format";
import { httpHref } from "@/lib/safe-url";
import {
  colorFamilyForSubject,
  getAccentTokens,
} from "@/lib/subject-colors";
import { Pill } from "@/components/student/pill";
import { ProgressRing } from "@/components/student/progress-ring";
import { VideoPlayer } from "./video-player";
import { BookletLink } from "./booklet-link";
import type { StudentCurriculumWeek } from "../_queries";

export async function WeekContent({
  week,
  subjectName,
}: {
  week: StudentCurriculumWeek;
  subjectName: string;
}) {
  const videoSignedUrl = await signCurriculumUrl(week.videoUrl);
  const tokens = getAccentTokens(colorFamilyForSubject(subjectName));

  const homeworkDone = week.homework.filter(
    (h) =>
      h.status === "marked" ||
      h.status === "submitted" ||
      h.status === "returned",
  ).length;
  const videoDone = Boolean(week.videoWatchedAt);
  const bookletDone = Boolean(week.bookletOpenedAt);

  const tasksTotal = 2 + (week.homework.length > 0 ? 1 : 0);
  const tasksDone =
    (videoDone ? 1 : 0) +
    (bookletDone ? 1 : 0) +
    (week.homework.length > 0 && homeworkDone >= week.homework.length ? 1 : 0);
  const completionPct =
    tasksTotal === 0 ? 0 : Math.round((tasksDone / tasksTotal) * 100);

  return (
    <div className="space-y-3.5">
      {/* HERO — compact, vibrant, subject-coloured */}
      <section
        className="relative overflow-hidden rounded-[22px] px-5 py-4 text-white shadow-[0_14px_32px_-18px_rgba(31,40,90,0.5)]"
        style={{
          background: `radial-gradient(140% 160% at 0% 0%, ${withAlpha(tokens.bgFrom, 0.65)} 0%, transparent 45%), radial-gradient(120% 140% at 100% 0%, ${withAlpha(tokens.bgFrom, 0.4)} 0%, transparent 55%), linear-gradient(135deg, ${tokens.arrow} 0%, ${tokens.title} 100%)`,
        }}
      >
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          className="absolute -right-8 -top-12 w-[200px] h-[200px] opacity-50 pointer-events-none"
          fill="none"
        >
          <circle cx="70" cy="30" r="34" fill="rgba(255,255,255,0.12)" />
          <circle cx="70" cy="30" r="22" fill="rgba(255,255,255,0.10)" />
          <circle cx="70" cy="30" r="11" fill="rgba(255,255,255,0.14)" />
        </svg>

        <div className="relative z-10 flex items-center justify-between gap-5 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.18em] font-extrabold opacity-85">
              Week {week.weekNumber}
            </div>
            <h2 className="m-0 mt-0.5 text-[22px] lg:text-[26px] font-extrabold tracking-[-0.02em] leading-tight">
              {week.title}
            </h2>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <HeroChip
                done={videoDone}
                icon={<PlayCircle className="h-3 w-3" />}
                label={videoDone ? "Video watched" : "Watch video"}
              />
              <HeroChip
                done={bookletDone}
                icon={<BookOpen className="h-3 w-3" />}
                label={bookletDone ? "Booklet opened" : "Open booklet"}
              />
              {week.homework.length > 0 && (
                <HeroChip
                  done={homeworkDone >= week.homework.length}
                  icon={<FileText className="h-3 w-3" />}
                  label={`HW ${homeworkDone}/${week.homework.length}`}
                />
              )}
              {week.quiz && (
                <HeroChip
                  done={false}
                  icon={<ListChecks className="h-3 w-3" />}
                  label="Quiz ready"
                />
              )}
            </div>
          </div>

          <div className="shrink-0 text-center">
            <ProgressRing
              value={completionPct}
              size={76}
              stroke={9}
              color="#FFFFFF"
              track="rgba(255,255,255,0.22)"
              labelClass="absolute inset-0 grid place-items-center font-extrabold tracking-[-0.02em] text-white text-[15px]"
              label={`${completionPct}%`}
            />
          </div>
        </div>
      </section>

      {/* OVERVIEW — what this week covers */}
      {week.description && (
        <section>
          <SectionHead title="Overview" />
          <div className="rounded-[18px] border border-line bg-surface p-4 text-[14px] text-ink leading-relaxed whitespace-pre-wrap shadow-[0_1px_2px_rgba(15,17,30,0.04)]">
            {week.description}
          </div>
        </section>
      )}

      {/* VIDEO + BOOKLET — side-by-side */}
      <div className="grid md:grid-cols-[1.6fr_1fr] gap-4">
        {/* Video */}
        <div className="rounded-[20px] border border-line bg-surface overflow-hidden shadow-[0_1px_2px_rgba(15,17,30,0.04),0_8px_24px_-16px_rgba(31,40,90,0.16)]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <div className="flex items-center gap-2">
              <span
                className="h-7 w-7 rounded-[9px] grid place-items-center"
                style={{ background: tokens.bgFrom, color: tokens.arrow }}
              >
                <PlayCircle className="h-4 w-4" />
              </span>
              <h3 className="m-0 text-[14px] font-bold text-ink">
                Recorded lesson
              </h3>
            </div>
            {videoDone ? (
              <Pill tone="good">Watched · {relativeTime(week.videoWatchedAt!)}</Pill>
            ) : (
              <Pill tone="muted">Not watched</Pill>
            )}
          </div>
          <div className="p-3.5">
            {videoSignedUrl ? (
              <VideoPlayer
                src={videoSignedUrl}
                subjectWeekId={week.subjectWeekId}
                alreadyWatched={videoDone}
              />
            ) : (
              <div
                className="rounded-[14px] grid place-items-center min-h-[180px] text-center"
                style={{
                  background: `linear-gradient(135deg, ${tokens.bgFrom} 0%, ${tokens.bgTo} 100%)`,
                  color: tokens.meta,
                }}
              >
                <div>
                  <PlayCircle
                    className="h-12 w-12 mx-auto mb-2 opacity-60"
                    style={{ color: tokens.arrow }}
                  />
                  <div className="text-[13px] font-semibold">
                    No video uploaded yet
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Booklet */}
        <div className="rounded-[20px] border border-line bg-surface overflow-hidden flex flex-col shadow-[0_1px_2px_rgba(15,17,30,0.04),0_8px_24px_-16px_rgba(31,40,90,0.16)]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <div className="flex items-center gap-2">
              <span
                className="h-7 w-7 rounded-[9px] grid place-items-center"
                style={{ background: tokens.bgFrom, color: tokens.arrow }}
              >
                <BookOpen className="h-4 w-4" />
              </span>
              <h3 className="m-0 text-[14px] font-bold text-ink">Booklet</h3>
            </div>
            {bookletDone ? (
              <Pill tone="good">Opened</Pill>
            ) : (
              <Pill tone="muted">New</Pill>
            )}
          </div>
          <div className="p-4 flex-1 flex flex-col">
            {week.bookletUrl ? (
              <>
                <div
                  className="flex-1 rounded-[14px] grid place-items-center text-center p-6 min-h-[120px]"
                  style={{
                    background: `linear-gradient(135deg, ${tokens.bgFrom} 0%, ${tokens.bgTo} 100%)`,
                  }}
                >
                  <div>
                    <FileText
                      className="h-10 w-10 mx-auto"
                      style={{ color: tokens.arrow }}
                    />
                    <div
                      className="mt-2 text-[11px] uppercase tracking-[0.16em] font-bold"
                      style={{ color: tokens.meta }}
                    >
                      Week PDF
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <BookletLink
                    subjectWeekId={week.subjectWeekId}
                    alreadyOpened={bookletDone}
                  />
                </div>
              </>
            ) : (
              <div
                className="flex-1 rounded-[14px] grid place-items-center text-center p-4 min-h-[140px]"
                style={{ background: tokens.bgTo, color: tokens.meta }}
              >
                <div>
                  <BookOpen
                    className="h-9 w-9 mx-auto mb-2 opacity-50"
                    style={{ color: tokens.arrow }}
                  />
                  <div className="text-[13px] font-semibold">No booklet yet</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TUTOR NOTES — extra material the tutor added for this week */}
      {(week.tutorNote || week.tutorAttachments.length > 0) && (
        <section>
          <SectionHead title="Tutor notes" count={week.tutorAttachments.length} />
          <div
            className="relative overflow-hidden rounded-[18px] border border-line bg-surface p-4 space-y-3 shadow-[0_1px_2px_rgba(15,17,30,0.04)]"
          >
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-1"
              style={{ background: tokens.arrow }}
            />
            {week.tutorNote && (
              <div className="text-[13px] text-ink-soft leading-relaxed whitespace-pre-wrap">
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
                      className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-background px-3 py-2 text-[12px] font-semibold text-ink hover:bg-surface transition-colors"
                    >
                      <Icon
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: tokens.arrow }}
                      />
                      {att.fileName}
                    </a>
                  ) : (
                    <span
                      key={att.id}
                      className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-background px-3 py-2 text-[12px] font-semibold text-muted"
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

      {week.quiz && (
        <section>
          <SectionHead title="Weekly quiz" />
          <Link
            href={`/student/quizzes/${week.quiz.id}`}
            className="group relative flex min-h-32 items-center gap-4 overflow-hidden rounded-[20px] border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,17,30,0.04),0_12px_28px_-20px_rgba(31,40,90,0.28)] transition-all duration-200 motion-reduce:transition-none hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-22px_rgba(31,40,90,0.38)] motion-reduce:hover:translate-y-0"
          >
            <span
              aria-hidden
              className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px]"
              style={{ background: tokens.bgFrom, color: tokens.arrow }}
            >
              <ListChecks className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block text-[10px] font-extrabold uppercase tracking-[0.16em]"
                style={{ color: tokens.meta }}
              >
                Approved practice quiz
              </span>
              <span className="mt-1 block text-[17px] font-extrabold tracking-[-0.01em] text-ink">
                {week.quiz.title}
              </span>
              <span className="mt-1 block text-[12px] font-semibold text-muted">
                {week.quiz.questionCount}{" "}
                {week.quiz.questionCount === 1 ? "question" : "questions"}
              </span>
            </span>
            <span
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[12px] font-bold text-white transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
              style={{ background: tokens.arrow }}
            >
              Start quiz <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </section>
      )}

      {/* HOMEWORK — card grid */}
      <section>
        <SectionHead
          title="Homework"
          count={week.homework.length}
          right={
            week.homework.length > 0 ? (
              <span className="text-[12px] text-muted font-semibold">
                {homeworkDone}/{week.homework.length} done
              </span>
            ) : null
          }
        />
        {week.homework.length === 0 ? (
          <EmptyCard message="No homework tagged to this week." />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3.5">
            {week.homework.map((h) => {
              const done =
                h.status === "submitted" ||
                h.status === "marked" ||
                h.status === "returned";
              const overdue =
                !done && (h.status === "late" || h.dueDate < new Date());
              return (
                <Link
                  key={h.homeworkId}
                  href={`/student/homework/${h.homeworkId}`}
                  className="group relative rounded-[18px] border border-line bg-surface p-4 overflow-hidden transition-all hover:-translate-y-[2px] hover:shadow-[0_18px_36px_-20px_rgba(31,40,90,0.32)]"
                >
                  <div
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-1.5"
                    style={{
                      background: done
                        ? "var(--good)"
                        : overdue
                          ? "var(--bad)"
                          : tokens.arrow,
                    }}
                  />
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Pill
                      tone={done ? "good" : overdue ? "bad" : "muted"}
                    >
                      {done ? (
                        <>
                          <Check className="h-3 w-3" /> Done
                        </>
                      ) : overdue ? (
                        <>
                          <AlertCircle className="h-3 w-3" /> Overdue
                        </>
                      ) : (
                        h.status.replace(/_/g, " ")
                      )}
                    </Pill>
                    {h.score && (
                      <span
                        className="text-[14px] font-extrabold tabular-nums"
                        style={{ color: tokens.arrow }}
                      >
                        {h.score}
                      </span>
                    )}
                  </div>
                  <div className="text-[14px] font-extrabold text-ink leading-tight line-clamp-2">
                    {h.title}
                  </div>
                  <div className="mt-2 text-[12px] text-muted">
                    Due {formatDueDate(h.dueDate)}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionHead({
  title,
  count,
  right,
}: {
  title: string;
  count?: number;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3 px-1">
      <div className="flex items-baseline gap-2">
        <h3 className="m-0 text-[18px] font-extrabold tracking-[-0.01em] text-ink">
          {title}
        </h3>
        {typeof count === "number" && count > 0 && (
          <span className="text-[12px] text-muted tabular-nums font-bold">
            {count}
          </span>
        )}
      </div>
      {right}
    </div>
  );
}

function HeroChip({
  done,
  icon,
  label,
}: {
  done: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border " +
        (done
          ? "bg-white/95 border-white text-ink"
          : "bg-white/15 border-white/30 text-white")
      }
    >
      {done ? <Check className="h-3 w-3" strokeWidth={3} /> : icon}
      {label}
    </span>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-line bg-surface/60 px-4 py-6 text-center text-[13px] text-muted">
      {message}
    </div>
  );
}

function withAlpha(rgb: string, a: number): string {
  // Input format is "rgb(r, g, b)" from AccentTokens.bgFrom etc.
  const match = rgb.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (!match) return rgb;
  return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${a})`;
}
