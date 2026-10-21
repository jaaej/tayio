"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, SidePanel } from "@/components/admin/ui";
import { ActionButtonLabel } from "@/components/ui/loading-button";
import {
  getReportEntryContext,
  saveTermReportEntry,
  type ReportEntryContext,
} from "@/app/_actions/term-report-entries";
import {
  RATING_SCALE,
  REPORT_RATINGS,
  SUMMARY_MAX,
  checkEntry,
  ratingLabel,
  type RatingKey,
  type Ratings,
} from "@/lib/term-report-entry-rules";
import { cn } from "@/lib/utils";

export type ReportTarget = {
  studentId: string;
  termId: string;
  subjectId: string;
  /** "Mia Chen · Year 9 Maths", the panel's title. */
  title: string;
};

const SECTION = "panel flex flex-col gap-3 p-[18px]";
const HEADING = "text-[13px] font-extrabold text-muted";

function count(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** The subject's term in numbers, to write the summary from. */
function TermFacts({ subject }: { subject: ReportEntryContext["subject"] }) {
  const facts = [
    ["Grade", subject.grade ? `${subject.grade.letter} · ${subject.grade.percent}%` : "No quiz or test scores yet"],
    ["Attendance", subject.attendance.total > 0 ? `${subject.attendance.attended} of ${count(subject.attendance.total, "lesson")}` : "No lessons marked yet"],
    ["Homework handed in", subject.homework.set > 0 ? `${subject.homework.handedIn} of ${subject.homework.set}` : "None set"],
    ["Quizzes", subject.quizzes.length > 0 ? subject.quizzes.map((q) => `${q.label} ${q.percent}%`).join(", ") : "None taken"],
    ["Covered", subject.topics.length > 0 ? subject.topics.join("; ") : "No curriculum weeks yet"],
  ];
  return (
    <dl className="grid gap-2 text-[13px]">
      {facts.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[132px_minmax(0,1fr)] gap-2">
          <dt className="font-bold text-ink">{label}</dt>
          <dd className="text-ink-soft [overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RatingField({
  ratingKey,
  label,
  value,
  onChange,
  disabled,
}: {
  ratingKey: RatingKey;
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
      <legend className="mb-1.5 flex w-full items-baseline justify-between gap-2 text-[14px] font-bold text-ink">
        {label}
        <span className="text-[12px] font-semibold text-ink-soft">{value ? ratingLabel(value) : "Not rated"}</span>
      </legend>
      <div className="grid grid-cols-5 gap-1 rounded-[12px] bg-surface-2 p-1">
        {RATING_SCALE.map((word, i) => {
          const n = i + 1;
          return (
            <label
              key={word}
              title={word}
              className={cn(
                "grid h-10 cursor-pointer place-items-center rounded-[9px] text-[14px] font-extrabold tabular-nums transition-colors duration-150",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400",
                value === n ? "bg-white text-ink shadow-[0_1px_3px_rgba(23,21,43,.12)]" : "text-ink-soft hover:text-ink",
                disabled && "cursor-default",
              )}
            >
              <input
                type="radio"
                name={`${name}-${ratingKey}`}
                value={n}
                checked={value === n}
                onChange={() => onChange(n)}
                className="sr-only"
                aria-label={`${label} ${n}, ${word}`}
              />
              {n}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * The tutor's part of one student's term report for one subject: the term's
 * numbers to write from, a summary and three ratings. The same panel for
 * tutors (Term reports) and admins (Reports > Term reports, to review).
 */
export function TermReportWriter({
  target,
  onClose,
}: {
  target: ReportTarget | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [context, setContext] = useState<ReportEntryContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [ratings, setRatings] = useState<Ratings>({ effort: 0, homework: 0, understanding: 0 });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const summaryId = useId();

  useEffect(() => {
    if (!target) return;
    let live = true;
    setContext(null);
    setLoadError(null);
    setError(null);
    getReportEntryContext(target)
      .then((res) => {
        if (!live) return;
        if (!res.ok) {
          setLoadError(res.error);
          return;
        }
        setContext(res.context);
        setSummary(res.context.entry?.summary ?? "");
        setRatings({
          effort: res.context.entry?.effort ?? 0,
          homework: res.context.entry?.homework ?? 0,
          understanding: res.context.entry?.understanding ?? 0,
        });
      })
      .catch(() => live && setLoadError("This report could not be opened. Try again."));
    return () => {
      live = false;
    };
  }, [target]);

  const readOnly = context?.readOnly ?? null;

  function save() {
    if (!target) return;
    const invalid = checkEntry({ summary, ...ratings });
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    start(async () => {
      const res = await saveTermReportEntry({ ...target, summary, ...ratings }).catch(() => null);
      if (!res) setError("It could not be saved. Try again.");
      else if (!res.ok) setError(res.error);
      else {
        router.refresh();
        onClose();
      }
    });
  }

  const footer =
    context && !readOnly ? (
      <>
        <Button type="button" size="lg" variant="outline" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" size="lg" variant="primary" disabled={pending} onClick={save}>
          <ActionButtonLabel pending={pending} pendingLabel="Saving…">
            Save
          </ActionButtonLabel>
        </Button>
      </>
    ) : (
      <Button type="button" size="lg" variant="outline" onClick={onClose}>
        Close
      </Button>
    );

  return (
    <SidePanel
      open={target !== null}
      onClose={onClose}
      title={target?.title ?? "Term report"}
      sub={context?.termLabel}
      footer={footer}
      sections
    >
      {loadError ? (
        <p role="alert" className="panel p-[18px] text-[14px] font-semibold text-bad">
          {loadError}
        </p>
      ) : !context ? (
        <p className="panel p-[18px] text-[14px] text-ink-soft" aria-live="polite">
          Loading…
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {readOnly && (
            <p role="status" className="rounded-[14px] bg-warn-bg px-4 py-3 text-[13px] font-semibold text-warn">
              {readOnly}
            </p>
          )}
          <section className={SECTION} aria-labelledby={`${summaryId}-facts`}>
            <h3 id={`${summaryId}-facts`} className={HEADING}>
              This term
            </h3>
            <TermFacts subject={context.subject} />
          </section>

          <section className={SECTION}>
            <label htmlFor={summaryId} className={HEADING}>
              Summary
            </label>
            <textarea
              id={summaryId}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              readOnly={Boolean(readOnly)}
              rows={8}
              maxLength={SUMMARY_MAX}
              placeholder="How the term went, what they did well, and what to work on next."
              className="w-full resize-y rounded-[12px] border border-line-field bg-white px-3.5 py-3 text-[15px] leading-relaxed text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10 read-only:bg-surface-2"
            />
          </section>

          <section className={SECTION}>
            <h3 className={HEADING}>Ratings</h3>
            {REPORT_RATINGS.map((r) => (
              <RatingField
                key={r.key}
                ratingKey={r.key}
                label={r.label}
                value={ratings[r.key]}
                disabled={Boolean(readOnly) || pending}
                onChange={(value) => setRatings((prev) => ({ ...prev, [r.key]: value }))}
              />
            ))}
          </section>

          {error && (
            <p role="alert" className="rounded-[12px] bg-bad-bg px-3.5 py-2.5 text-[13px] font-semibold text-bad">
              {error}
            </p>
          )}
        </div>
      )}
    </SidePanel>
  );
}
