import Link from "next/link";
import { ChevronLeft, LineChart } from "lucide-react";
import { formatDateShort, formatScore, melbourneDayKey } from "@/lib/format";
import { subjectTone } from "@/lib/subject-tone";
import { cn } from "@/lib/utils";
import { MASTERY_LEVEL_LABEL, type MasteryLevel } from "@/lib/topic-mastery";
import type { RecentMark } from "../_lib/progress";
import type { ProgressDetail } from "../_lib/progress-data";

/** Bar colour, pill fill and pill text per level; `none` before any marks. */
const LEVEL: Record<MasteryLevel | "none", { c: string; bg: string; fg: string }> = {
  strong: { c: "#15803D", bg: "#E3F4EC", fg: "#15803D" },
  improving: { c: "#3B4FD8", bg: "#E7EFFD", fg: "#1E4FB8" },
  needs_work: { c: "#D97706", bg: "#FDF1E0", fg: "#8A4A06" },
  none: { c: "#8C8AA0", bg: "#EEEFF6", fg: "#4A4660" },
};

const LEGEND: MasteryLevel[] = ["strong", "improving", "needs_work"];

/**
 * Right pane of the progress split view: subject title with the term's test
 * rank, mastery and the term's average score, topic bars with effort labels
 * and the term's latest marks.
 */
export function ProgressDetailPane({
  detail,
  backHref = "/student/progress",
  desktopOnly = false,
}: {
  detail: ProgressDetail;
  /** The list on phones, keeping the chosen term. */
  backHref?: string;
  /** The index page's default subject: phones show the list instead. */
  desktopOnly?: boolean;
}) {
  const facts = [
    { k: "Mastery", v: detail.masteryPercent === null ? "-" : `${detail.masteryPercent}%` },
    { k: "Average score", v: detail.averagePercent === null ? "-" : `${detail.averagePercent}%` },
  ];

  return (
    <section
      aria-labelledby="pd-h"
      className={cn(
        "glass min-w-0 flex-col gap-1.5 rounded-[24px] p-1.5",
        desktopOnly ? "hidden xl:flex" : "flex",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 pl-3.5 pr-2.5 pt-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={backHref}
            aria-label="All subjects"
            title="All subjects"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-white/95 bg-white/65 text-[#17152B] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 xl:hidden"
          >
            <ChevronLeft className="h-[17px] w-[17px]" strokeWidth={2.4} aria-hidden />
          </Link>
          <h2
            id="pd-h"
            className="m-0 flex min-w-0 items-center gap-2 text-[20px] font-extrabold text-[#17152B]"
          >
            <span
              aria-hidden
              className="h-[11px] w-[11px] shrink-0 rounded-[4px]"
              style={{ background: subjectTone(detail.subjectName, detail.subjectColor).dot }}
            />
            <span className="min-w-0 [overflow-wrap:anywhere]">{detail.subjectName}</span>
          </h2>
        </div>
        {detail.rank && (
          <span className="flex h-7 items-center rounded-[14px] bg-[#17152B] px-3 text-[12px] font-extrabold text-white">
            Test rank #{detail.rank.rank} of {detail.rank.total}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {facts.map((f) => (
          <div key={f.k} className="panel flex flex-col gap-0.5 px-3.5 py-3">
            <span className="text-[12px] font-bold text-[#5E5A73]">{f.k}</span>
            <span className="text-[22px] font-extrabold tabular-nums text-[#17152B]">{f.v}</span>
          </div>
        ))}
      </div>

      <div className="panel flex flex-col gap-3 p-4">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-extrabold text-[#17152B]">Topics</span>
          <span className="flex flex-wrap gap-2.5 text-[11px] font-bold text-[#5E5A73]">
            {LEGEND.map((level) => (
              <span key={level} className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ background: LEVEL[level].c }}
                />
                {MASTERY_LEVEL_LABEL[level]}
              </span>
            ))}
          </span>
        </span>
        {detail.topics.length > 0 ? (
          detail.topics.map((t) => {
            const level = LEVEL[t.level ?? "none"];
            return (
              <div
                key={t.topicId}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_140px_150px]"
              >
                <span className="min-w-0 text-[14px] font-bold text-[#17152B] [overflow-wrap:anywhere]">
                  {t.topic}
                </span>
                <span
                  aria-hidden
                  title={t.percent === null ? undefined : `${t.percent}%`}
                  className="order-last col-span-2 h-2 overflow-hidden rounded-[4px] bg-[#EEEFF6] sm:order-none sm:col-span-1"
                >
                  <span
                    className="block h-full"
                    style={{ width: `${t.percent ?? 0}%`, background: level.c }}
                  />
                </span>
                <span
                  className="flex h-[22px] items-center justify-self-end whitespace-nowrap rounded-[11px] px-2 text-[11px] font-extrabold"
                  style={{ background: level.bg, color: level.fg }}
                >
                  {t.level && <span className="sr-only">{t.percent}%, </span>}
                  {t.level ? MASTERY_LEVEL_LABEL[t.level] : "No marks yet"}
                </span>
              </div>
            );
          })
        ) : (
          <p className="text-[13px] text-[#5E5A73]">
            This subject&apos;s curriculum has no topics yet.
          </p>
        )}
      </div>

      <div className="panel flex-1 overflow-hidden">
        <div className="px-4 pb-2 pt-3.5 text-[13px] font-extrabold text-[#17152B]">Recent marks</div>
        {detail.marks.length === 0 ? (
          <p className="border-t border-[#EFF0F5] px-4 py-6 text-center text-[13px] text-[#5E5A73]">
            Nothing marked yet.
          </p>
        ) : (
          detail.marks.map((m) => <MarkRow key={`${m.kind}-${m.id}`} mark={m} />)
        )}
      </div>
    </section>
  );
}

function markMeta(mark: RecentMark): string {
  if (mark.kind === "quiz") {
    return [
      "Practice",
      formatDateShort(melbourneDayKey(mark.at)),
      mark.tries > 1 ? `latest of ${mark.tries} tries` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return [
    mark.isTest ? "Test" : null,
    mark.at ? `Marked ${formatDateShort(melbourneDayKey(mark.at))}` : "Marked",
    mark.feedback ? `“${mark.feedback}”` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function MarkRow({ mark }: { mark: RecentMark }) {
  const href =
    mark.kind === "quiz" ? `/student/quizzes/${mark.id}` : `/student/homework/${mark.id}`;
  return (
    <Link
      href={href}
      className="flex items-center gap-3 border-t border-[#EFF0F5] px-4 py-2.5 text-[#17152B] transition-colors hover:bg-[#F8F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-bold">{mark.title}</span>
        <span className="line-clamp-2 text-[12px] text-[#5E5A73]">{markMeta(mark)}</span>
      </span>
      <span className="shrink-0 text-[15px] font-extrabold tabular-nums">
        {mark.kind === "quiz" ? `${mark.correctCount} / ${mark.total}` : formatScore(mark.percent)}
      </span>
    </Link>
  );
}

/** Wide-screen right pane when the student has no subjects yet. */
export function ProgressRestingPane() {
  return (
    <section
      aria-label="Subject progress"
      className="glass hidden min-h-[420px] flex-col rounded-[24px] p-1.5 xl:flex"
    >
      <div className="panel flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <span
          aria-hidden
          className="grid h-12 w-12 place-items-center rounded-full bg-[#EEEFF6] text-[#5E5A73]"
        >
          <LineChart className="h-[22px] w-[22px]" />
        </span>
        <p className="text-[15px] font-extrabold text-[#17152B]">No subjects yet</p>
      </div>
    </section>
  );
}
