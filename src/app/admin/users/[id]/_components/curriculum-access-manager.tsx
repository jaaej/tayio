"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, UnlockKeyhole } from "lucide-react";
import {
  grantCurriculumTermAccess,
  revokeCurriculumTermAccess,
} from "@/app/admin/_lib/actions-curriculum-access";
import type { AdminCurriculumAccessSubject } from "@/app/admin/_lib/curriculum-access";
import { formatDateLong } from "@/lib/format";

export function CurriculumAccessManager({
  studentId,
  subjects,
}: {
  studentId: string;
  subjects: AdminCurriculumAccessSubject[];
}) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function change(
    subjectId: string,
    termId: string,
    granted: boolean,
  ) {
    const key = `${subjectId}:${termId}`;
    setPendingKey(key);
    setError(null);
    start(async () => {
      const action = granted
        ? revokeCurriculumTermAccess
        : grantCurriculumTermAccess;
      const result = await action({ studentId, subjectId, termId });
      if (!result.ok) setError(result.error);
      else router.refresh();
      setPendingKey(null);
    });
  }

  if (subjects.length === 0) {
    return (
      <p className="text-[13px] text-muted">
        Enrol this student in a class before managing curriculum access.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-ink-soft">
        Students automatically receive material from their enrolment term
        onward. Use these controls only when they need an earlier term.
      </p>

      {subjects.map((subject) => (
        <section
          key={subject.subjectId}
          className="overflow-hidden rounded-[14px] border border-line"
        >
          <div className="bg-surface-2 px-4 py-3">
            <div className="text-[14px] font-bold text-ink">
              {subject.subjectName}
            </div>
            <div className="mt-0.5 text-[12px] text-muted">
              Enrolled {formatDateLong(subject.enrolledDate)} · Automatic access{" "}
              {subject.automaticFrom
                ? `from Term ${subject.automaticFrom.termNumber}, ${subject.automaticFrom.year}`
                : "starts when the next configured term begins"}
            </div>
          </div>

          {subject.earlierTerms.length === 0 ? (
            <p className="px-4 py-3 text-[12px] text-muted">
              There are no earlier curriculum terms for this subject.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {subject.earlierTerms.map((term) => {
                const key = `${subject.subjectId}:${term.id}`;
                const saving = pending && pendingKey === key;
                return (
                  <li
                    key={term.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-[9px] ${
                          term.granted
                            ? "bg-good-bg text-good"
                            : "bg-surface-2 text-muted"
                        }`}
                      >
                        {term.granted ? (
                          <UnlockKeyhole className="h-4 w-4" />
                        ) : (
                          <LockKeyhole className="h-4 w-4" />
                        )}
                      </span>
                      <div>
                        <div className="text-[13px] font-bold text-ink">
                          Term {term.termNumber}, {term.year}
                        </div>
                        <div className="text-[11px] text-muted">
                          {term.granted ? "Manually available" : "Restricted"}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        change(subject.subjectId, term.id, term.granted)
                      }
                      className={`min-h-9 rounded-full px-3.5 text-[12px] font-bold transition-colors disabled:opacity-50 ${
                        term.granted
                          ? "border border-line text-ink hover:bg-surface-2"
                          : "bg-brand-600 text-white hover:bg-brand-700"
                      }`}
                    >
                      {saving
                        ? "Saving…"
                        : term.granted
                          ? "Remove access"
                          : "Grant access"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}

      {error ? (
        <p role="alert" className="text-[12px] font-semibold text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
