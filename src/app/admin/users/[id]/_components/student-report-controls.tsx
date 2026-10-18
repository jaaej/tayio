"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/admin/ui";
import { Download, Send } from "lucide-react";
import { issueStudentReport } from "@/app/admin/_lib/actions-reports";
import { ActionButtonLabel } from "@/components/ui/loading-button";

type Term = { id: string; label: string };

const SELECT =
  "h-9 rounded-[10px] border border-line bg-surface px-2.5 text-[13px] text-ink focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25";

export function StudentReportControls({
  studentId,
  terms,
  sentOn,
}: {
  studentId: string;
  terms: Term[];
  /** "12 Oct" by term id, for reports already sent to the family. */
  sentOn: Record<string, string>;
}) {
  const router = useRouter();
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
            ? "No family to send it to: no parent is linked and the student can't open reports."
            : `Sent to ${res.notified} ${res.notified === 1 ? "person" : "people"}.`,
        );
        router.refresh();
      } catch {
        setMsg("Couldn't send the report. Try again.");
      }
    });
  }

  return (
    <div className="space-y-2.5">
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
          <ActionButtonLabel pending={pending} pendingLabel="Sending…">
            <>
              <Send className="h-4 w-4" aria-hidden />
              {sentOn[termId] ? "Send again" : "Send to family"}
            </>
          </ActionButtonLabel>
        </button>
        {sentOn[termId] ? (
          <Pill tone="good">Sent {sentOn[termId]}</Pill>
        ) : (
          <Pill tone="warn">Not sent</Pill>
        )}
      </div>
      {msg && <p className="text-[12px] font-semibold text-ink-soft">{msg}</p>}
    </div>
  );
}
