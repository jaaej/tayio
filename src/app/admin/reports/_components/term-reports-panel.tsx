import Link from "next/link";
import { Download } from "lucide-react";
import { Empty, GlassPanel, Pill, buttonVariants } from "@/components/admin/ui";
import { UrlLabelledSelect } from "@/components/admin/ui/labelled-select";
import { formatDateShort } from "@/lib/format";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { cn } from "@/lib/utils";
import type { TermReportClass, TermReportStudent } from "@/app/admin/_lib/term-reports";
import { IssueClassButton, IssueStudentButton } from "./issue-report-buttons";
import { ReviewReportButton } from "./review-report-button";

export type TermReportRow = TermReportStudent & {
  /** Subjects the student had this term, and how many have their tutor's part. */
  subjects: number;
  written: number;
};

/**
 * Reports > Term reports: one class at a time, every student with how much
 * of their report the tutors have written, whether it has gone to the
 * family, Review (this class's subject, in the tutors' writer), a PDF
 * preview, and sending for one student or everyone not yet sent.
 */
export function TermReportsPanel({
  termId,
  classes,
  classId,
  roster,
}: {
  termId: string;
  classes: TermReportClass[];
  classId: string | null;
  roster: TermReportRow[];
}) {
  const toSend = roster.filter((s) => s.issuedAt === null && s.recipients > 0);
  const notSent = toSend.length;
  const subject = classes.find((c) => c.id === classId);
  return (
    <GlassPanel
      title="Term reports"
      titleId="term-reports-heading"
      action={
        classes.length > 0 && (
          <span className="flex flex-wrap items-center gap-2">
            <UrlLabelledSelect
              label="Class"
              param="class"
              options={classes.map((c) => ({ value: c.id, label: c.label }))}
            />
            {classId && (
              <IssueClassButton
                termId={termId}
                classId={classId}
                count={notSent}
                incomplete={toSend.filter((s) => s.written < s.subjects).length}
              />
            )}
          </span>
        )
      }
    >
      {classes.length === 0 || !classId ? (
        <Empty>No classes had students this term.</Empty>
      ) : roster.length === 0 ? (
        <Empty>No students in this class this term.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {roster.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5"
            >
              <Link
                href={`/admin/users/${s.id}?tab=reports`}
                className="min-w-0 flex-[1_1_160px] truncate text-[14px] font-bold text-ink hover:text-brand-700 hover:underline"
              >
                {s.name}
              </Link>
              {s.subjects > 0 && (
                <span className="shrink-0">
                  <Pill tone={s.written === s.subjects ? "info" : "default"}>
                    {s.written} of {s.subjects} written
                  </Pill>
                </span>
              )}
              <span className="shrink-0">
                {s.recipients === 0 ? (
                  <Pill tone="default">No family linked</Pill>
                ) : s.issuedAt ? (
                  <Pill tone="good">Sent {formatDateShort(melbourneDate(s.issuedAt))}</Pill>
                ) : (
                  <Pill tone="warn">Not sent</Pill>
                )}
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-1.5">
                {subject && (
                  <ReviewReportButton
                    target={{
                      studentId: s.id,
                      termId,
                      subjectId: subject.subjectId,
                      title: `${s.name} · ${subject.label}`,
                    }}
                  />
                )}
                <a
                  href={`/reports/${s.id}/${termId}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  PDF
                  <span className="sr-only"> for {s.name}</span>
                </a>
                {s.recipients > 0 && (
                  <IssueStudentButton
                    studentId={s.id}
                    termId={termId}
                    sent={s.issuedAt !== null}
                    studentName={s.name}
                    missing={s.subjects - s.written}
                  />
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}
