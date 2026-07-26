"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  addQuestion,
  updateQuestionPrompt,
  deleteQuestion,
  addOption,
  updateOption,
  deleteOption,
  setCorrectOption,
  submitQuiz,
} from "@/app/_actions/quizzes";
import type { QuizWithContent } from "@/lib/quiz-queries";

type Question = QuizWithContent["questions"][number];
type Option = Question["options"][number];
type ActionResult = Awaited<ReturnType<typeof updateQuestionPrompt>>;

const QUESTION_TYPE_LABEL: Record<string, string> = {
  multiple_choice: "Multiple choice",
  true_false: "True / False",
};

/**
 * Shared question + option editor for both the admin and tutor quiz pages.
 * When `editable` is false, every control is read-only except the back link.
 * Each row manages its own pending/error state so one slow save never locks
 * the rest of the form.
 */
export function QuizMaker({
  quiz,
  questions,
  editable,
  canSubmit,
  hrefBack,
}: QuizWithContent & { editable: boolean; canSubmit: boolean; hrefBack: string }) {
  const [footerError, setFooterError] = useState<string | null>(null);
  const [footerPending, startFooter] = useTransition();

  function runFooter(action: () => Promise<ActionResult>) {
    setFooterError(null);
    startFooter(async () => {
      const result = await action();
      if (!result.ok) setFooterError(result.error);
    });
  }

  return (
    <div className="space-y-5">
      <Link
        href={hrefBack}
        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-brand-700 transition-colors hover:text-brand-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="rounded-[14px] border border-line bg-surface px-4 py-3.5">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Quiz</div>
        <div className="mt-0.5 text-[17px] font-extrabold tracking-[-0.01em] text-ink">
          {quiz.title}
        </div>
      </div>

      <div className="space-y-4">
        {questions.length === 0 && (
          <div className="rounded-[14px] border border-line bg-surface px-4 py-6 text-center text-[13px] text-muted">
            {editable ? "No questions yet. Add one below." : "No questions yet."}
          </div>
        )}
        {questions.map((question, index) => (
          <QuestionCard key={question.id} index={index} question={question} editable={editable} />
        ))}
      </div>

      {editable && (
        <div className="space-y-2.5 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={footerPending}
              onClick={() =>
                runFooter(() => addQuestion({ quizId: quiz.id, type: "multiple_choice" }))
              }
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-[13px] font-bold text-ink transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add multiple-choice question
            </button>
            <button
              type="button"
              disabled={footerPending}
              onClick={() => runFooter(() => addQuestion({ quizId: quiz.id, type: "true_false" }))}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-[13px] font-bold text-ink transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add true/false question
            </button>
            <button
              type="button"
              disabled={footerPending || !canSubmit}
              title={!canSubmit ? "This quiz can't be submitted for review right now." : undefined}
              onClick={() => runFooter(() => submitQuiz({ quizId: quiz.id }))}
              className="ml-auto inline-flex min-h-11 items-center justify-center rounded-full bg-brand-600 px-5 text-[13px] font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Submit for review
            </button>
          </div>
          {footerError && (
            <p role="alert" className="text-[13px] font-semibold text-bad">
              {footerError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  index,
  editable,
}: {
  question: Question;
  index: number;
  editable: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isTrueFalse = question.type === "true_false";
  const promptId = `quiz-prompt-${question.id}`;

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="rounded-[14px] border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label
            htmlFor={promptId}
            className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted"
          >
            Question {index + 1}
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-brand-ink">
              {QUESTION_TYPE_LABEL[question.type] ?? question.type}
            </span>
          </label>
          {editable ? (
            <input
              id={promptId}
              defaultValue={question.prompt}
              placeholder="Type the question prompt"
              disabled={pending}
              onBlur={(e) => {
                const value = e.target.value;
                if (value === question.prompt) return;
                run(() => updateQuestionPrompt({ questionId: question.id, prompt: value }));
              }}
              className="min-h-11 w-full rounded-[12px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-brand-500 disabled:opacity-60"
            />
          ) : (
            <p id={promptId} className="min-h-11 py-2.5 text-[14px] text-ink">
              {question.prompt || <span className="text-muted">(no prompt)</span>}
            </p>
          )}
        </div>
        {editable && (
          <button
            type="button"
            disabled={pending}
            aria-label={`Delete question ${index + 1}`}
            onClick={() => {
              if (!confirm(`Delete question ${index + 1}? This cannot be undone.`)) return;
              run(() => deleteQuestion({ questionId: question.id }));
            }}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-bad transition-colors hover:bg-bad-bg disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>

      <fieldset className="mt-3 space-y-2">
        <legend className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
          Options - select the correct answer
        </legend>
        {question.options.map((option, optionIndex) => (
          <OptionRow
            key={option.id}
            option={option}
            questionId={question.id}
            index={optionIndex}
            editable={editable}
            locked={isTrueFalse}
            canDelete={!isTrueFalse && question.options.length > 2}
          />
        ))}
        {editable && !isTrueFalse && <AddOptionButton questionId={question.id} />}
      </fieldset>

      {error && (
        <p role="alert" className="mt-2 text-[13px] font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

function AddOptionButton({ questionId }: { questionId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await addOption({ questionId });
            if (!result.ok) setError(result.error);
          });
        }}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-line px-3.5 text-[13px] font-bold text-brand-700 transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-4 w-4" /> Add option
      </button>
      {error && (
        <p role="alert" className="mt-1 text-[13px] font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

function OptionRow({
  option,
  questionId,
  index,
  editable,
  locked,
  canDelete,
}: {
  option: Option;
  questionId: string;
  index: number;
  editable: boolean;
  locked: boolean;
  canDelete: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const showTextInput = editable && !locked;

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <label
          className={
            "grid h-11 w-11 shrink-0 place-items-center rounded-full " +
            (editable ? "cursor-pointer" : "cursor-default")
          }
        >
          <input
            type="radio"
            name={`quiz-correct-${questionId}`}
            checked={option.isCorrect}
            disabled={!editable || pending}
            onChange={() => run(() => setCorrectOption({ questionId, optionId: option.id }))}
            aria-label={`Mark option ${index + 1} as the correct answer`}
            className="h-5 w-5 accent-brand-600 disabled:cursor-not-allowed"
          />
        </label>
        {showTextInput ? (
          <input
            defaultValue={option.text}
            placeholder={`Option ${index + 1}`}
            disabled={pending}
            aria-label={`Option ${index + 1} text`}
            onBlur={(e) => {
              const value = e.target.value;
              if (value === option.text) return;
              run(() => updateOption({ optionId: option.id, text: value }));
            }}
            className="min-h-11 w-full rounded-[12px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-brand-500 disabled:opacity-60"
          />
        ) : (
          <span className="min-h-11 flex-1 rounded-[12px] px-3.5 py-2.5 text-[14px] text-ink">
            {option.text || <span className="text-muted">(empty)</span>}
            {option.isCorrect && (
              <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-brand-ink">
                Correct
              </span>
            )}
          </span>
        )}
        {editable && canDelete && (
          <button
            type="button"
            disabled={pending}
            aria-label={`Delete option ${index + 1}`}
            onClick={() => run(() => deleteOption({ optionId: option.id }))}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-bad transition-colors hover:bg-bad-bg disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 pl-[52px] text-[12px] font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
