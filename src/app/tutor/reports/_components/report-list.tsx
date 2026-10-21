"use client";

import { useState } from "react";
import { Button, GlassPanel, Pill } from "@/components/admin/ui";
import { TermReportWriter, type ReportTarget } from "@/components/reports/term-report-writer";

export type ReportListClass = {
  classId: string;
  label: string;
  subjectId: string;
  students: { id: string; name: string; written: boolean; sentLabel: string | null }[];
};

/** A tutor's classes for the term, each student with their part's state and a Write button. */
export function ReportList({ termId, classes }: { termId: string; classes: ReportListClass[] }) {
  const [target, setTarget] = useState<ReportTarget | null>(null);
  return (
    <>
      {classes.map((c) => {
        const toWrite = c.students.filter((s) => !s.written && !s.sentLabel).length;
        return (
          <GlassPanel
            key={c.classId}
            title={c.label}
            titleId={`reports-${c.classId}`}
            meta={toWrite > 0 ? `${toWrite} to write` : undefined}
          >
            <ul className="divide-y divide-line">
              {c.students.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
                  <span className="min-w-0 flex-[1_1_120px] truncate text-[14px] font-bold text-ink">{s.name}</span>
                  <span className="shrink-0">
                    {s.sentLabel ? (
                      <Pill tone="good">{s.sentLabel}</Pill>
                    ) : s.written ? (
                      <Pill tone="info">Written</Pill>
                    ) : (
                      <Pill tone="warn">To write</Pill>
                    )}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={s.written || s.sentLabel ? "outline" : "primary"}
                    className="ml-auto"
                    aria-label={`${s.sentLabel ? "View" : s.written ? "Edit" : "Write"} ${s.name}'s report`}
                    onClick={() =>
                      setTarget({ studentId: s.id, termId, subjectId: c.subjectId, title: `${s.name} · ${c.label}` })
                    }
                  >
                    {s.sentLabel ? "View" : s.written ? "Edit" : "Write"}
                  </Button>
                </li>
              ))}
            </ul>
          </GlassPanel>
        );
      })}
      <TermReportWriter target={target} onClose={() => setTarget(null)} />
    </>
  );
}
