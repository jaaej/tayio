"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, SidePanel } from "@/components/admin/ui";
import { createQuizDirect, requestQuiz } from "@/app/_actions/quizzes";
import type { QuizTargetWeek } from "@/lib/quiz-queries";
import { cn } from "@/lib/utils";
import { NewQuizForm, type NewQuizValues } from "./new-quiz-form";
import { RequestQuizForm, type RequestQuizValues } from "./request-quiz-form";

type Tab = "write" | "request";

const TABS: { value: Tab; label: string }[] = [
  { value: "write", label: "I'll write it" },
  { value: "request", label: "Ask a tutor" },
];

/**
 * One slide-over for both ways a quiz starts. Writing it yourself and asking a
 * tutor differ only in who fills in the questions, so they belong on one
 * surface with a switch rather than two places to look; the page header's two
 * buttons are two doors into it, each landing on the matching tab.
 */
export function NewQuizPanel({
  tutors,
  weeks,
  /** "new" drops the request button - used where the brand action is the whole
   *  surface (the empty state) and a second button would compete with it. */
  triggers = "both",
  triggerSize = "md",
}: {
  tutors: { id: string; name: string }[];
  weeks: QuizTargetWeek[];
  triggers?: "both" | "new";
  triggerSize?: "md" | "lg";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("write");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // The page mounts this twice (header + empty state), so the id wiring the
  // footer submit back to the form has to be per-instance as well as per-tab.
  const baseId = useId();
  const formId = `${baseId}-${tab}`;

  function openWith(next: Tab) {
    setError(null);
    setTab(next);
    setOpen(true);
  }

  function switchTo(next: Tab) {
    if (pending) return;
    setError(null);
    setTab(next);
  }

  function write(values: NewQuizValues) {
    setError(null);
    start(async () => {
      const res = await createQuizDirect(values);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      // Straight into the maker: a draft with no questions is not finished
      // work, so the next step is the point of creating it.
      router.push(`/admin/quizzes/${res.id}`);
    });
  }

  function request(values: RequestQuizValues) {
    setError(null);
    start(async () => {
      const res = await requestQuiz(values);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.push(`/admin/quizzes/${res.id}`);
    });
  }

  const blocker =
    weeks.length === 0
      ? "No unused subject weeks are available. Add a curriculum week or edit its existing quiz."
      : tab === "request" && tutors.length === 0
        ? "Add an active tutor account before requesting a quiz."
        : null;

  const footer = blocker ? (
    <Button
      type="button"
      size="lg"
      variant="outline"
      onClick={() => setOpen(false)}
    >
      Close
    </Button>
  ) : (
    <>
      <Button
        type="button"
        size="lg"
        variant="ghost"
        disabled={pending}
        onClick={() => setOpen(false)}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form={formId}
        size="lg"
        variant="brand"
        disabled={pending}
      >
        {tab === "write"
          ? pending
            ? "Creating…"
            : "Create draft"
          : pending
            ? "Sending…"
            : "Send request"}
      </Button>
    </>
  );

  return (
    <>
      {triggers === "both" && (
        <Button
          type="button"
          variant="outline"
          size={triggerSize}
          onClick={() => openWith("request")}
        >
          Request from tutor
        </Button>
      )}
      {/* Default `md` height, matching every other admin PageHeader action.
          The panel's own buttons stay `lg`: it goes full-width on mobile, so
          those are real thumb targets in a way a desktop header action is not. */}
      <Button
        type="button"
        variant="brand"
        size={triggerSize}
        onClick={() => openWith("write")}
      >
        <Plus className="h-4 w-4" aria-hidden />
        New quiz
      </Button>

      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title="New quiz"
        sub="Set it up here, then add questions."
        footer={footer}
      >
        <div className="space-y-5">
          <AuthorSwitch value={tab} disabled={pending} onChange={switchTo} />

          {blocker ? (
            <p className="text-[13px] text-ink-soft">{blocker}</p>
          ) : (
            <>
              {tab === "write" ? (
                <NewQuizForm
                  formId={formId}
                  weeks={weeks}
                  disabled={pending}
                  error={error}
                  onSubmit={write}
                />
              ) : (
                <RequestQuizForm
                  formId={formId}
                  tutors={tutors}
                  weeks={weeks}
                  disabled={pending}
                  error={error}
                  onSubmit={request}
                />
              )}

              <div className="rounded-[10px] border border-brand-200 bg-brand-50 p-3">
                <p className="text-[13px] font-bold text-ink">
                  {tab === "write"
                    ? "Saves as a draft"
                    : "Sends a request to the tutor"}
                </p>
                <p className="mt-1 text-[12px] text-ink-soft">
                  {tab === "write"
                    ? "You'll add questions on the next screen. Students only see it once you publish."
                    : "They build the questions and send it back for review. Students only see it once you approve it."}
                </p>
              </div>
            </>
          )}
        </div>
      </SidePanel>
    </>
  );
}

/**
 * Real radios behind the segments, so arrow-key navigation, grouping and
 * screen-reader announcement come from the browser instead of hand-rolled key
 * handling - the same trick the create-user role picker uses.
 */
function AuthorSwitch({
  value,
  disabled,
  onChange,
}: {
  value: Tab;
  disabled: boolean;
  onChange: (tab: Tab) => void;
}) {
  const groupName = useId();

  return (
    <div
      role="radiogroup"
      aria-label="Who writes this quiz"
      className="grid grid-cols-2 gap-1 rounded-[12px] border border-line bg-surface-2 p-1"
    >
      {TABS.map((option) => {
        const active = value === option.value;
        return (
          <label
            key={option.value}
            className={cn(
              "inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[9px] px-3 text-center text-[13px] font-bold transition-colors",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500",
              active
                ? "bg-surface text-brand-700 shadow-[0_1px_2px_rgba(15,17,30,0.10)]"
                : "text-muted hover:text-ink",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <input
              type="radio"
              name={groupName}
              value={option.value}
              checked={active}
              disabled={disabled}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
