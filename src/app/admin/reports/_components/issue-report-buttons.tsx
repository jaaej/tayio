"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/admin/ui";
import { ActionButtonLabel } from "@/components/ui/loading-button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { issueClassTermReports, issueStudentReport } from "@/app/admin/_lib/actions-reports";

/** Issue (or re-issue) one student's term report from the class list. */
export function IssueStudentButton({
  studentId,
  termId,
  sent,
  studentName,
  missing = 0,
}: {
  studentId: string;
  termId: string;
  sent: boolean;
  studentName: string;
  /** Subjects whose tutor's summary is not written yet. */
  missing?: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const { confirm, confirmDialog } = useConfirm();
  return (
    <>
      <Button
        type="button"
        variant={sent ? "outline" : "primary"}
        size="sm"
        disabled={pending}
        aria-label={`${sent ? "Send again" : "Send"} ${studentName}'s report`}
        onClick={async () => {
          if (
            missing > 0 &&
            !(await confirm({
              title: `Send ${studentName}'s report?`,
              body: `${missing} ${missing === 1 ? "subject has" : "subjects have"} no tutor's summary yet, so the report goes without ${missing === 1 ? "it" : "them"}.`,
              confirmLabel: "Send anyway",
            }))
          ) {
            return;
          }
          setError(false);
          start(async () => {
            try {
              await issueStudentReport({ studentId, termId });
              router.refresh();
            } catch {
              setError(true);
            }
          });
        }}
      >
        <ActionButtonLabel pending={pending} pendingLabel="Sending…">
          {error ? "Try again" : sent ? "Send again" : "Send"}
        </ActionButtonLabel>
      </Button>
      {confirmDialog}
    </>
  );
}

/** Issue the report to every student in the class who has not had theirs. */
export function IssueClassButton({
  termId,
  classId,
  count,
  incomplete = 0,
}: {
  termId: string;
  classId: string;
  count: number;
  /** Of those, how many still lack a tutor's summary for a subject. */
  incomplete?: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();
  return (
    <span className="flex flex-wrap items-center gap-2">
      {message && (
        <span role="status" className="text-[12px] font-semibold text-ink-soft">
          {message}
        </span>
      )}
      <Button
        type="button"
        variant="primary"
        size="md"
        disabled={pending || count === 0}
        onClick={async () => {
          if (
            incomplete > 0 &&
            !(await confirm({
              title: `Send ${count} ${count === 1 ? "report" : "reports"}?`,
              body: `${incomplete} of them ${incomplete === 1 ? "is" : "are"} missing a tutor's summary for a subject, and will go without it.`,
              confirmLabel: "Send anyway",
            }))
          ) {
            return;
          }
          setMessage(null);
          start(async () => {
            try {
              const res = await issueClassTermReports({ termId, classId });
              if (!res.ok) setMessage(res.error);
              else if (res.failed > 0) {
                setMessage(`${res.failed} could not be sent. Try again.`);
              }
              router.refresh();
            } catch {
              setMessage("Couldn't send the reports. Try again.");
            }
          });
        }}
      >
        <ActionButtonLabel pending={pending} pendingLabel="Sending…">
          <>
            <Send className="h-4 w-4" aria-hidden />
            Send {count} {count === 1 ? "report" : "reports"}
          </>
        </ActionButtonLabel>
      </Button>
      {confirmDialog}
    </span>
  );
}
