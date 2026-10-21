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
import { FIELD_MAX, REPORT_FIELDS, checkEntry, type EntryText } from "@/lib/term-report-entry-rules";
import { BANDS } from "@/lib/attainment-bands";
import type { BandRating } from "@/lib/student-report";
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
const EMPTY: EntryText = { strengths: "", toWorkOn: "", goals: "" };

/** Six steps filled up to the band, with its name; as on the report. */
function Rating({ rating }: { rating: BandRating | null }) {
  if (!rating) return <span className="text-[13px] text-muted">Not yet assessed</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="flex gap-0.5" aria-hidden>
        {BANDS.map((b) => (
          <span
            key={b.value}
            className={cn("h-1.5 w-3 rounded-[2px]", b.value <= rating.band ? "bg-brand-400" : "bg-surface-3")}
          />
        ))}
      </span>
      <span className="text-[13px] font-bold text-ink">{rating.label}</span>
    </span>
  );
}

/** The subject's term from the portal's records, to write from. */
function TermFacts({ subject }: { subject: ReportEntryContext["subject"] }) {
  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-bold text-ink">Overall</span>
          <Rating rating={subject.overall} />
        </div>
        {subject.topicRatings.map((t) => (
          <div key={t.name} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-ink-soft">{t.name}</span>
            <Rating rating={t.rating} />
          </div>
        ))}
      </div>
      <dl className="grid gap-1.5 border-t border-line pt-3">
        {[
          ["Results", subject.results.length > 0 ? subject.results.map((r) => `${r.label} ${r.percent}%`).join(", ") : "No quizzes or tests yet"],
          ["Attendance", subject.attendance.total > 0 ? `${subject.attendance.attended} of ${subject.attendance.total} lessons` : "No lessons marked yet"],
          ["Homework handed in", subject.homework.set > 0 ? `${subject.homework.handedIn} of ${subject.homework.set}` : "None set"],
        ].map(([label, value]) => (
          <div key={label} className="grid grid-cols-[132px_minmax(0,1fr)] gap-2">
            <dt className="font-bold text-ink">{label}</dt>
            <dd className="text-ink-soft [overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * The tutor's part of one student's term report for one subject: the term
 * from the portal's records (the system's ratings, results, attendance) and
 * the tutor's strengths, things to work on and goals. The same panel for
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
  const [text, setText] = useState<EntryText>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fieldId = useId();

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
        const entry = res.context.entry;
        setText(entry ? { strengths: entry.strengths, toWorkOn: entry.toWorkOn, goals: entry.goals } : EMPTY);
      })
      .catch(() => live && setLoadError("This report could not be opened. Try again."));
    return () => {
      live = false;
    };
  }, [target]);

  const readOnly = context?.readOnly ?? null;

  function save() {
    if (!target) return;
    const invalid = checkEntry(text);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    start(async () => {
      const res = await saveTermReportEntry({ ...target, ...text }).catch(() => null);
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
          <section className={SECTION} aria-labelledby={`${fieldId}-facts`}>
            <h3 id={`${fieldId}-facts`} className={HEADING}>
              This term
            </h3>
            <TermFacts subject={context.subject} />
          </section>

          <section className={SECTION}>
            {REPORT_FIELDS.map((f) => (
              <div key={f.key} className="flex flex-col gap-1.5">
                <label htmlFor={`${fieldId}-${f.key}`} className="text-[14px] font-bold text-ink">
                  {f.label}
                </label>
                <textarea
                  id={`${fieldId}-${f.key}`}
                  value={text[f.key]}
                  onChange={(e) => setText((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  readOnly={Boolean(readOnly)}
                  rows={3}
                  maxLength={FIELD_MAX}
                  placeholder={f.hint}
                  className="w-full resize-y rounded-[12px] border border-line-field bg-white px-3.5 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10 read-only:bg-surface-2"
                />
              </div>
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
