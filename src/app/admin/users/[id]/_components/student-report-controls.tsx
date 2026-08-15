"use client";

import { useState, useTransition } from "react";
import { Download, Send } from "lucide-react";
import { issueStudentReport } from "@/app/admin/_lib/actions-reports";

type Term = { id: string; label: string };

const SELECT =
  "h-9 rounded-[10px] border border-line bg-surface px-2.5 text-[13px] text-ink focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25";

export function StudentReportControls({
  studentId,
  terms,
}: {
  studentId: string;
  terms: Term[];
}) {
  const [termId, setTermId] = useState(terms[0]?.id ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (terms.length === 0) {
    return (
      <p className="text-[13px] text-muted">
        No terms exist yet - create a term before generating reports.
      </p>
    );
  }

  function issue() {
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await issueStudentReport({ studentId, termId });
        setMsg(
          res.notified === 0
            ? "No family recipients to notify (no parent linked; student is restricted)."
            : `Notified ${res.notified} recipient${res.notified === 1 ? "" : "s"}.`,
        );
      } catch {
        setMsg("Couldn't issue the report - try again.");
      }
    });
  }

  return (
    <div className="space-y-2.5">
      <p className="text-[13px] text-muted">
        Generate a branded PDF (attendance, quiz + test grades, tutor comments)
        for a term, then issue it to the family with an in-app notification.
      </p>
      <div className="flex flex-wrap items-center gap-2.5">
        <select
          className={SELECT}
          value={termId}
          onChange={(e) => {
            setTermId(e.target.value);
            setMsg(null);
          }}
        >
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        <a
          href={`/reports/${studentId}/${termId}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-[12px] font-bold text-ink hover:bg-brand-50 hover:border-brand-300 transition-colors"
        >
          <Download className="h-4 w-4" aria-hidden />
          Download PDF
        </a>

        <button
          type="button"
          onClick={issue}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-[12px] font-bold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <Send className="h-4 w-4" aria-hidden />
          {pending ? "Issuing…" : "Issue to family"}
        </button>
      </div>
      {msg && <p className="text-[12px] font-semibold text-ink-soft">{msg}</p>}
    </div>
  );
}
