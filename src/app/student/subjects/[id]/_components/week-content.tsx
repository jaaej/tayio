import Link from "next/link";
import type { ReactNode } from "react";
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
import { cn } from "@/lib/utils";
import {
  colorFamilyForSubject,
  getAccentTokens,
} from "@/lib/subject-colors";
import { ProgressRing } from "@/components/student/progress-ring";
import { VideoPlayer } from "./video-player";
import { BookletLink } from "./booklet-link";
import type { StudentCurriculumWeek } from "../_queries";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const CARD_SHADOW = "shadow-[0_1px_2px_rgba(15,17,30,0.04)]";
const CARD_HOVER_SHADOW = "hover:shadow-[0_12px_28px_-18px_rgba(15,17,30,0.28)]";

export async function WeekContent({
  week,
  subjectName,
}: {
  week: StudentCurriculumWeek;
  subjectName: string;
}) {
  const videoSignedUrl = await signCurriculumUrl(week.videoUrl);
  // Subject accent survives in exactly one place in this file: the progress
  // ring below. Every other surface, tile and icon in this component is
  // neutral - colour is a spotlight, not decoration.
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
      {/* HEADER - calm neutral row. Eyebrow + title carry hierarchy through
          type, not colour; the progress ring is the one spotlight element. */}
      <section
        className={cn(
          "flex items-center justify-between gap-4 rounded-[22px] border border-line bg-surface px-5 py-4",
          CARD_SHADOW,
        )}
      >
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted">
            Week {week.weekNumber}
          </div>
          <h2 className="m-0 mt-1 text-[22px] lg:text-[26px] font-extrabold tracking-[-0.02em] leading-tight text-ink">
            {week.title}
          </h2>
        </div>
        <div className="shrink-0">
          <ProgressRing
            value={completionPct}
            size={56}
            stroke={6}
            color={tokens.arrow}
            track="var(--surface-2)"
            labelClass="absolute inset-0 grid place-items-center font-extrabold tracking-[-0.02em] text-ink text-[12px]"
            label={`${completionPct}%`}
          />
        </div>
      </section>

      {/* OVERVIEW - what this week covers */}
      {week.description && (
        <section>
          <SectionHead title="Overview" />
          <div
            className={cn(
              "rounded-[22px] border border-line bg-surface p-5 text-[14px] text-ink leading-relaxed whitespace-pre-wrap",
              CARD_SHADOW,
            )}
          >
            {week.description}
          </div>
        </section>
      )}

      {/* VIDEO + BOOKLET - side-by-side */}
      <div className="grid md:grid-cols-[1.6fr_1fr] gap-4">
        {/* Video */}
        <div
          className={cn(
            "rounded-[22px] border border-line bg-surface overflow-hidden",
            CARD_SHADOW,
          )}
        >
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[14px] bg-surface-2 text-ink-soft">
                <PlayCircle className="h-5 w-5" />
              </span>
              <h3 className="m-0 text-[14px] font-bold text-ink">
                Recorded lesson
              </h3>
            </div>
            <StatusPill tone={videoDone ? "good" : "neutral"}>
              {videoDone
                ? `Watched · ${relativeTime(week.videoWatchedAt!)}`
                : "Not watched"}
            </StatusPill>
          </div>
          <div className="p-5">
            {videoSignedUrl ? (
              <VideoPlayer
                src={videoSignedUrl}
                subjectWeekId={week.subjectWeekId}
                alreadyWatched={videoDone}
              />
            ) : (
              <div className="rounded-[14px] bg-surface-2 grid place-items-center min-h-[180px] text-center text-muted">
                <div>
                  <PlayCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <div className="text-[13px] font-semibold">
                    No video uploaded yet
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Booklet */}
        <div
          className={cn(
            "rounded-[22px] border border-line bg-surface overflow-hidden flex flex-col",
            CARD_SHADOW,
          )}
        >
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[14px] bg-surface-2 text-ink-soft">
                <BookOpen className="h-5 w-5" />
              </span>
              <h3 className="m-0 text-[14px] font-bold text-ink">Booklet</h3>
            </div>
            <StatusPill tone={bookletDone ? "good" : "neutral"}>
              {bookletDone ? "Opened" : "New"}
            </StatusPill>
          </div>
          <div className="p-5 flex-1 flex flex-col">
            {week.bookletUrl ? (
              <>
                <div className="flex-1 rounded-[14px] bg-surface-2 grid place-items-center text-center p-6 min-h-[120px] text-muted">
                  <div>
                    <FileText className="h-10 w-10 mx-auto opacity-60" />
                    <div className="mt-2 text-[11px] uppercase tracking-[0.16em] font-bold">
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
              <div className="flex-1 rounded-[14px] bg-surface-2 grid place-items-center text-center p-4 min-h-[140px] text-muted">
                <div>
                  <BookOpen className="h-9 w-9 mx-auto mb-2 opacity-50" />
                  <div className="text-[13px] font-semibold">No booklet yet</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TUTOR NOTES - extra material the tutor added for this week */}
      {(week.tutorNote || week.tutorAttachments.length > 0) && (
        <section>
          <SectionHead title="Tutor notes" count={week.tutorAttachments.length} />
          <div
            className={cn(
              "rounded-[22px] border border-line bg-surface p-5 space-y-3",
              CARD_SHADOW,
            )}
          >
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
                      className={cn(
                        "inline-flex min-h-11 items-center gap-1.5 rounded-[14px] border border-line bg-surface-2 px-3 text-[12px] font-semibold text-ink transition-colors motion-reduce:transition-none hover:bg-surface-3",
                        FOCUS_RING,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted" />
                      {att.fileName}
                    </a>
                  ) : (
                    <span
                      key={att.id}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-[14px] border border-line bg-surface-2 px-3 text-[12px] font-semibold text-muted"
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
            className={cn(
              "group relative flex min-h-32 items-center gap-4 overflow-hidden rounded-[22px] border border-line bg-surface p-5 transition-all duration-200 motion-reduce:transition-none hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
              CARD_SHADOW,
              CARD_HOVER_SHADOW,
              FOCUS_RING,
            )}
          >
            <span
              aria-hidden
              className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-surface-2 text-ink-soft"
            >
              <ListChecks className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
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
            <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-[12px] font-bold text-white transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
              Start quiz <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </section>
      )}

      {/* HOMEWORK - card grid */}
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
                  className={cn(
                    "group relative rounded-[22px] border border-line bg-surface p-5 transition-all duration-200 motion-reduce:transition-none hover:-translate-y-[2px] motion-reduce:hover:translate-y-0",
                    CARD_SHADOW,
                    CARD_HOVER_SHADOW,
                    FOCUS_RING,
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <StatusPill tone={done ? "good" : overdue ? "bad" : "neutral"}>
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
                    </StatusPill>
                    {h.score && (
                      <span className="text-[14px] font-extrabold tabular-nums text-ink">
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
  right?: ReactNode;
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

/**
 * Small neutral status chip - colour appears only in the leading dot, never
 * in the pill's background or text, per the colour-as-spotlight system.
 */
function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: "good" | "warn" | "bad" | "neutral";
  children: ReactNode;
}) {
  const dotColor =
    tone === "good"
      ? "var(--good)"
      : tone === "warn"
        ? "var(--warn)"
        : tone === "bad"
          ? "var(--bad)"
          : "var(--line-strong)";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-[3px] text-[11px] font-bold text-ink-soft">
      <span
        aria-hidden
        className="h-[6px] w-[6px] shrink-0 rounded-full"
        style={{ background: dotColor }}
      />
      {children}
    </span>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-line bg-surface/60 px-4 py-6 text-center text-[13px] text-muted">
      {message}
    </div>
  );
}
