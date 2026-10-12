"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/admin/ui";
import { ActionSpinner } from "@/components/ui/loading-button";
import { markSubmission } from "@/app/tutor/_actions";
import { cn } from "@/lib/utils";

const RESULTS = [
  { value: "marked", label: "Marked", tone: "text-good" },
  { value: "resubmission_requested", label: "Request resubmit", tone: "text-warn" },
  { value: "returned", label: "Returned", tone: "text-info" },
] as const;

type Result = (typeof RESULTS)[number]["value"];

const FIELD_CLS =
  "w-full rounded-[12px] border border-line-strong bg-surface text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10";

/**
 * Result, score and feedback for one submission. "Save & next" moves to the
 * next item in the to-mark queue (or back to the list when it is empty).
 */
export function MarkForm({
  homeworkId,
  studentId,
  studentFirstName,
  status,
  score,
  feedback,
  nextHref,
  doneHref,
}: {
  homeworkId: string;
  studentId: string;
  studentFirstName: string;
  status: string;
  score: string | null;
  feedback: string | null;
  nextHref: string | null;
  doneHref: string;
}) {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result>(
    RESULTS.some((r) => r.value === status) ? (status as Result) : "marked",
  );
  const [outcome, setOutcome] = useState<"saved" | "error" | null>(null);

  function save(form: HTMLFormElement, goNext: boolean) {
    const formData = new FormData(form);
    setOutcome(null);
    startTransition(async () => {
      try {
        await markSubmission(formData);
      } catch {
        setOutcome("error");
        return;
      }
      if (goNext) {
        router.push(nextHref ?? doneHref);
        return;
      }
      setOutcome("saved");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(e.currentTarget, false);
      }}
      onChange={() => setOutcome(null)}
      className="flex flex-1 flex-col"
    >
      <input type="hidden" name="homeworkId" value={homeworkId} />
      <input type="hidden" name="studentId" value={studentId} />
      <div className="flex flex-col gap-3.5 p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
          <div className="flex flex-col gap-1.5">
            <span id={`${id}-result`} className="text-[13px] font-bold text-ink">
              Result
            </span>
            <div
              role="radiogroup"
              aria-labelledby={`${id}-result`}
              className="flex gap-0.5 rounded-[12px] bg-[#F1F2F7] p-[3px]"
            >
              {RESULTS.map((r) => {
                const checked = result === r.value;
                return (
                  <label key={r.value} className="flex flex-1 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value={r.value}
                      checked={checked}
                      onChange={() => setResult(r.value)}
                      className="peer sr-only"
                    />
                    <span
                      className={cn(
                        "flex h-9 w-full items-center justify-center whitespace-nowrap rounded-[9px] px-1.5 text-[12.5px] font-extrabold transition-colors duration-150 sm:text-[13px]",
                        "peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400",
                        checked
                          ? cn("bg-surface shadow-[0_1px_3px_rgba(23,21,43,0.14)]", r.tone)
                          : "text-muted hover:text-ink",
                      )}
                    >
                      {r.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-score`} className="text-[13px] font-bold text-ink">
              Score <span className="sr-only">(percent)</span>
            </label>
            <div className="relative">
              <input
                id={`${id}-score`}
                name="score"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max="100"
                defaultValue={score === null ? "" : Number(score)}
                placeholder="Optional"
                className={cn(FIELD_CLS, "h-[42px] pl-3 pr-8 text-[16px] font-extrabold tabular-nums placeholder:font-normal placeholder:text-muted")}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[14px] font-bold text-muted"
              >
                %
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-feedback`} className="text-[13px] font-bold text-ink">
            Feedback
          </label>
          <textarea
            id={`${id}-feedback`}
            name="feedback"
            rows={4}
            maxLength={5000}
            defaultValue={feedback ?? ""}
            placeholder="Constructive feedback for the student"
            className={cn(FIELD_CLS, "resize-y p-3 text-[14px] leading-[1.55]")}
          />
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line bg-[#FAFBFD] px-4 py-3.5">
        <p className="text-[13px] font-semibold text-ink-soft" aria-live="polite">
          {outcome === "error" ? (
            <span role="alert" className="text-bad">
              The mark could not be saved. Check the score is from 0 to 100 and try again.
            </span>
          ) : outcome === "saved" ? (
            <span className="inline-flex items-center gap-1 font-bold text-good">
              <Check className="h-4 w-4" aria-hidden />
              Saved
            </span>
          ) : (
            `${studentFirstName} and their parent see the score and feedback`
          )}
        </p>
        <div className="flex gap-2">
          <Button
            type="submit"
            variant="outline"
            disabled={pending}
            className="h-10 rounded-[11px] px-3.5"
          >
            Save
          </Button>
          <Button
            type="button"
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={(e) => {
              const form = e.currentTarget.form;
              if (form?.reportValidity()) save(form, true);
            }}
            className="h-10 rounded-[11px] px-[18px] text-[14px]"
          >
            {pending && <ActionSpinner />}
            {nextHref ? "Save & next" : "Save & finish"}
            {!pending && <ArrowRight className="h-4 w-4" aria-hidden />}
          </Button>
        </div>
      </div>
    </form>
  );
}
