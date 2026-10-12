import type { ReactNode } from "react";
import { Empty, Pill, SubjectDot } from "@/components/admin/ui";
import { formatTime } from "@/lib/format";
import {
  tutorCoverClassLabel,
  tutorCoverDateLabel,
} from "@/lib/tutor-cover-rules";
import { cn } from "@/lib/utils";

/*
 * The cover board's column and card, shared by admin Reschedules and the tutor
 * Cover board so both roles read the same card. Each role supplies its own
 * state line and actions; the card owns the layout.
 */

export type CoverCardTone = "good" | "warn" | "bad" | "info" | "muted";

const STATE_TONE: Record<CoverCardTone, string> = {
  good: "text-good",
  warn: "text-warn",
  bad: "text-bad",
  info: "text-info",
  muted: "text-muted",
};

export function CoverBoardColumn({
  id,
  title,
  dotClassName,
  count,
  empty,
  children,
}: {
  id: string;
  title: string;
  /** Background utility for the column's status dot. */
  dotClassName: string;
  count: number;
  empty: string;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section
      aria-labelledby={headingId}
      className="glass flex min-w-0 flex-col rounded-[24px] p-1.5"
    >
      <div className="flex items-center gap-2 pb-2.5 pl-3 pr-2 pt-2">
        <span aria-hidden className={cn("h-[9px] w-[9px] rounded-full", dotClassName)} />
        <h2 id={headingId} className="text-[15px] font-extrabold text-ink">
          {title}
        </h2>
        <span className="text-[13px] font-bold tabular-nums text-ink-soft">{count}</span>
      </div>
      {count === 0 ? (
        <div className="panel">
          <Empty className="py-6">{empty}</Empty>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">{children}</ul>
      )}
    </section>
  );
}

export function CoverCard({
  subjectName,
  className,
  date,
  startTime,
  endTime,
  location,
  reason,
  urgency,
  state,
  actions,
}: {
  subjectName: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  /** Who asked and why, e.g. "Daniel Lee: sick". */
  reason: string;
  /** Short urgency pill text, e.g. "Under 48h". */
  urgency?: string | null;
  state?: { text: string; tone: CoverCardTone } | null;
  /** Role-specific controls, beside the state line. */
  actions?: ReactNode;
}) {
  return (
    <li className="panel flex flex-col gap-2.5 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <SubjectDot subject={subjectName} className="h-2 w-2" />
        <span className="min-w-0 flex-1 text-[14px] font-extrabold text-ink">
          {tutorCoverClassLabel(subjectName, className)}
        </span>
        {urgency && <Pill tone="bad">{urgency}</Pill>}
      </div>
      <div className="flex flex-col gap-0.5 text-[13px]">
        <span className="font-bold text-ink">
          {tutorCoverDateLabel(date, className)} · {formatTime(startTime)} –{" "}
          {formatTime(endTime)}
        </span>
        <span className="text-muted">{location ?? "Location TBC"}</span>
      </div>
      <p className="rounded-[10px] bg-surface-2 px-2.5 py-2 text-[12px] text-ink-soft">
        {reason}
      </p>
      {(state || actions) && (
        // State on the left, actions on the right; a full-width action (the
        // admin assign form) wraps onto its own line under the state.
        <div className="flex flex-wrap items-center gap-2">
          {state && (
            <p
              className={cn(
                "min-w-0 flex-1 text-[12px] font-bold",
                STATE_TONE[state.tone],
              )}
            >
              {state.text}
            </p>
          )}
          {actions}
        </div>
      )}
    </li>
  );
}
