"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/admin/ui";
import { ActionButtonLabel } from "@/components/ui/loading-button";
import { issueClassTermReports, issueStudentReport } from "@/app/admin/_lib/actions-reports";

/** Issue (or re-issue) one student's term report from the class list. */
export function IssueStudentButton({
  studentId,
  termId,
  sent,
  studentName,
}: {
  studentId: string;
  termId: string;
  sent: boolean;
  studentName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  return (
    <Button
      type="button"
      variant={sent ? "outline" : "primary"}
      size="sm"
      disabled={pending}
      aria-label={`${sent ? "Send again" : "Send"} ${studentName}'s report`}
      onClick={() => {
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
  );
}

/** Issue the report to every student in the class who has not had theirs. */
export function IssueClassButton({
  termId,
  classId,
  count,
}: {
  termId: string;
  classId: string;
  count: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
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
        onClick={() => {
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
    </span>
  );
}
