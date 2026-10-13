"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Check,
  ChevronLeft,
  FileText,
  ImageIcon,
  RotateCcw,
  X,
} from "lucide-react";
import { gradePracticeQuiz } from "@/app/_actions/quizzes";
import type { StudentQuiz } from "@/lib/quiz-queries";
import { buttonVariants } from "@/components/admin/ui/button";
import { ActionButtonLabel } from "@/components/ui/loading-button";
import { cn } from "@/lib/utils";

type Grade = Extract<
  Awaited<ReturnType<typeof gradePracticeQuiz>>,
  { ok: true }
>["grade"];
type QuestionResult = Grade["results"][number];

type StudentQuestion = StudentQuiz["questions"][number];
type StudentAttachment = StudentQuiz["attachments"][number];

const TYPE_LABEL: Record<string, string> = {
  multiple_choice: "Multiple choice",
  true_false: "True / False",
};

function questionAnchor(id: string) {
  return `quiz-question-${id}`;
}

/**
 * A student's practice quiz, laid out like the shared quiz editor: a glass
 * header, the question outline beside every question on one page, and a
 * sticky footer that checks the answers. Grading runs on the server
 * (gradePracticeQuiz), so the answer key never reaches the browser until the
 * student submits.
 */
export function StudentPracticeQuiz({
  content,
  hrefBack,
}: {
  content: StudentQuiz;
  hrefBack: string;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [grade, setGrade] = useState<Grade | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { quiz, questions, attachments } = content;

  // Context items are passage containers, not gradable. Only leaves
  // (multiple_choice / true_false) are answerable and counted, matching
  // gradePracticeQuiz which grades non-context questions only.
  const leafQuestions = questions.filter((question) => question.type !== "context");
  const answeredCount = leafQuestions.filter((question) =>
    Boolean(answers[question.id]),
  ).length;
  const resultFor = (id: string) =>
    grade?.results.find((item) => item.questionId === id);

  const topLevel = questions
    .filter((question) => question.parentId === null)
    .sort((a, b) => a.position - b.position);
  const childrenByParent = new Map<string, StudentQuestion[]>();
  for (const question of questions) {
    if (question.parentId) {
      const list = childrenByParent.get(question.parentId) ?? [];
      list.push(question);
      childrenByParent.set(question.parentId, list);
    }
  }
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.position - b.position);
  }

  const attachmentsByQuestion = new Map<string, StudentAttachment[]>();
  for (const attachment of attachments) {
    if (attachment.questionId) {
      const list = attachmentsByQuestion.get(attachment.questionId) ?? [];
      list.push(attachment);
      attachmentsByQuestion.set(attachment.questionId, list);
    }
  }
  const generalAttachments = attachments.filter(
    (attachment) => attachment.questionId === null,
  );

  function checkAnswers() {
    setError(null);
    startTransition(async () => {
      const result = await gradePracticeQuiz({
        quizId: quiz.id,
        answers: leafQuestions
          .filter((question) => answers[question.id])
          .map((question) => ({
            questionId: question.id,
            optionId: answers[question.id],
          })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setGrade(result.grade);
    });
  }

  function retry() {
    setAnswers({});
    setGrade(null);
    setError(null);
  }

  function choose(questionId: string, optionId: string) {
    setAnswers((current) => ({ ...current, [questionId]: optionId }));
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="glass flex flex-wrap items-center justify-between gap-3.5 rounded-[24px] px-3.5 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            href={hrefBack}
            aria-label={`Back to week ${quiz.weekNumber}`}
            title={`Back to week ${quiz.weekNumber}`}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-white/95 bg-white/65 text-ink transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <ChevronLeft className="h-[17px] w-[17px]" strokeWidth={2.4} aria-hidden />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h1 className="break-words text-[20px] font-extrabold leading-tight text-ink">
              {quiz.title}
            </h1>
            <p className="text-[13px] font-semibold text-ink-soft">
              {quiz.subjectName} · practice quiz
            </p>
          </div>
        </div>
        <span className="flex h-8 items-center rounded-full bg-white px-3 text-[13px] font-extrabold tabular-nums text-ink">
          {grade
            ? `${grade.correctCount} of ${grade.total} correct`
            : `${answeredCount} of ${leafQuestions.length} answered`}
        </span>
      </header>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <QuestionOutline
          topLevel={topLevel}
          childrenByParent={childrenByParent}
          answers={answers}
          resultFor={resultFor}
          graded={Boolean(grade)}
          answered={answeredCount}
          total={leafQuestions.length}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {generalAttachments.length > 0 && (
            <section
              aria-labelledby="quiz-materials-heading"
              className="glass rounded-[24px] p-1.5"
            >
              <h2
                id="quiz-materials-heading"
                className="px-3 pb-2.5 pt-2 text-[16px] font-extrabold text-ink"
              >
                Quiz materials
              </h2>
              <div className="panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {generalAttachments.map((attachment) => (
                  <AttachmentCard key={attachment.id} attachment={attachment} />
                ))}
              </div>
            </section>
          )}

          {topLevel.length === 0 && (
            <p className="glass rounded-[24px] p-1.5">
              <span className="panel block px-6 py-10 text-center text-[13px] text-muted">
                This quiz has no questions yet.
              </span>
            </p>
          )}

          {topLevel.map((question, index) => {
            const number = String(index + 1);
            if (question.type !== "context") {
              return (
                <QuestionCard
                  key={question.id}
                  question={question}
                  label={number}
                  attachments={attachmentsByQuestion.get(question.id) ?? []}
                  selected={answers[question.id]}
                  result={resultFor(question.id)}
                  locked={Boolean(grade) || pending}
                  onChoose={choose}
                />
              );
            }
            const children = childrenByParent.get(question.id) ?? [];
            const passageAttachments = attachmentsByQuestion.get(question.id) ?? [];
            return (
              <div key={question.id} className="flex flex-col gap-5">
                <section
                  id={questionAnchor(question.id)}
                  aria-labelledby={`${questionAnchor(question.id)}-title`}
                  className="glass scroll-mt-[var(--portal-sticky-top)] rounded-[24px] p-1.5"
                >
                  <div className="flex min-h-11 items-center justify-between gap-3 px-3 py-1.5">
                    <h2
                      id={`${questionAnchor(question.id)}-title`}
                      className="text-[15px] font-extrabold text-ink"
                    >
                      Passage for question {number}
                    </h2>
                  </div>
                  <div className="panel flex flex-col gap-4 p-4">
                    <p className="whitespace-pre-wrap break-words text-[15px] font-medium leading-relaxed text-ink">
                      {question.prompt}
                    </p>
                    {passageAttachments.length > 0 && (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {passageAttachments.map((attachment) => (
                          <AttachmentCard key={attachment.id} attachment={attachment} />
                        ))}
                      </div>
                    )}
                  </div>
                </section>
                {children.map((child, childIndex) => (
                  <QuestionCard
                    key={child.id}
                    question={child}
                    label={`${number}${String.fromCharCode(97 + childIndex)}`}
                    attachments={attachmentsByQuestion.get(child.id) ?? []}
                    selected={answers[child.id]}
                    result={resultFor(child.id)}
                    locked={Boolean(grade) || pending}
                    onChoose={choose}
                  />
                ))}
              </div>
            );
          })}

          <div className="glass sticky bottom-4 z-10 rounded-[20px] p-1.5">
            <div className="panel flex flex-wrap items-center justify-between gap-3 px-3.5 py-3">
              {grade ? (
                <p aria-live="polite" className="text-[15px] font-extrabold text-ink">
                  You scored {grade.correctCount} out of {grade.total}
                </p>
              ) : (
                <p className="text-[14px] font-bold tabular-nums text-ink">
                  {answeredCount} of {leafQuestions.length} answered
                </p>
              )}
              {grade ? (
                <button
                  type="button"
                  onClick={retry}
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Try again
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending || leafQuestions.length === 0}
                  onClick={checkAnswers}
                  className={cn(buttonVariants({ variant: "primary", size: "lg" }), "px-5")}
                >
                  <ActionButtonLabel pending={pending} pendingLabel="Checking…">
                    Check answers
                  </ActionButtonLabel>
                </button>
              )}
              {error && (
                <p role="alert" className="basis-full text-[13px] font-semibold text-bad">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Numbered grid of the questions with an answered bar; each square jumps to
 *  its question and shows the result once checked. */
function QuestionOutline({
  topLevel,
  childrenByParent,
  answers,
  resultFor,
  graded,
  answered,
  total,
}: {
  topLevel: StudentQuestion[];
  childrenByParent: Map<string, StudentQuestion[]>;
  answers: Record<string, string>;
  resultFor: (id: string) => QuestionResult | undefined;
  graded: boolean;
  answered: number;
  total: number;
}) {
  const percent = total === 0 ? 0 : Math.round((answered / total) * 100);
  if (topLevel.length === 0) return null;

  return (
    <nav
      aria-labelledby="quiz-outline-heading"
      className="glass flex shrink-0 flex-col rounded-[24px] p-1.5 lg:sticky lg:top-[var(--portal-sticky-top)] lg:w-[240px]"
    >
      <div className="flex flex-col gap-2 px-3 pb-2.5 pt-2">
        <h2 id="quiz-outline-heading" className="text-[16px] font-extrabold text-ink">
          Questions
        </h2>
        <span
          role="progressbar"
          aria-label="Questions answered"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="block h-1.5 overflow-hidden rounded-[3px] bg-white/80"
        >
          <span
            className="block h-full rounded-[3px] bg-ink transition-[width] duration-200 motion-reduce:transition-none"
            style={{ width: `${percent}%` }}
          />
        </span>
      </div>
      <ol className="panel grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5 p-2 lg:grid-cols-5">
        {topLevel.map((question, index) => {
          const isContext = question.type === "context";
          const leaves = isContext ? (childrenByParent.get(question.id) ?? []) : [question];
          const done = leaves.length > 0 && leaves.every((q) => Boolean(answers[q.id]));
          const results = leaves.map((q) => resultFor(q.id));
          const correct = graded && results.every((r) => r?.isCorrect);
          const state = graded
            ? correct
              ? "Correct"
              : "Incorrect"
            : done
              ? "Answered"
              : "Not answered";
          return (
            <li key={question.id}>
              <a
                href={`#${questionAnchor(question.id)}`}
                title={state}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-[9px] border text-[13px] font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                  graded
                    ? correct
                      ? "border-good-bg bg-good-bg text-good"
                      : "border-bad-bg bg-bad-bg text-bad"
                    : done
                      ? "border-[#EEEFF6] bg-[#EEEFF6] text-ink"
                      : "border-[#DCDEE9] bg-white text-ink hover:bg-surface-2",
                )}
              >
                {index + 1}
                <span className="sr-only"> {state}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function QuestionCard({
  question,
  label,
  attachments,
  selected,
  result,
  locked,
  onChoose,
}: {
  question: StudentQuestion;
  label: string;
  attachments: StudentAttachment[];
  selected: string | undefined;
  result: QuestionResult | undefined;
  locked: boolean;
  onChoose: (questionId: string, optionId: string) => void;
}) {
  const anchor = questionAnchor(question.id);
  return (
    <section
      id={anchor}
      aria-labelledby={`${anchor}-title`}
      className="glass scroll-mt-[var(--portal-sticky-top)] rounded-[24px] p-1.5"
    >
      <div className="flex min-h-11 items-center justify-between gap-3 px-3 py-1.5">
        <h2 id={`${anchor}-title`} className="text-[15px] font-extrabold text-ink">
          Question {label}
        </h2>
        {result ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[12px] font-extrabold",
              result.isCorrect ? "text-good" : "text-bad",
            )}
          >
            {result.isCorrect ? (
              <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
            ) : (
              <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
            )}
            {result.isCorrect ? "Correct" : "Incorrect"}
          </span>
        ) : (
          <span className="text-[12px] font-bold text-ink-soft">
            {TYPE_LABEL[question.type] ?? ""}
          </span>
        )}
      </div>
      <fieldset className="panel flex min-w-0 flex-col gap-3 p-4">
        <legend className="sr-only">Question {label}</legend>
        <p className="whitespace-pre-wrap break-words text-[15px] font-semibold leading-normal text-ink">
          {question.prompt}
        </p>
        {attachments.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {attachments.map((attachment) => (
              <AttachmentCard key={attachment.id} attachment={attachment} />
            ))}
          </div>
        )}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-2">
          {question.options.map((option, optionIndex) => {
            const isSelected = selected === option.id;
            const isCorrect = result?.correctOptionId === option.id;
            const selectedWrong = Boolean(result && isSelected && !isCorrect);
            return (
              <label
                key={option.id}
                className={cn(
                  "flex min-h-[52px] items-center gap-2.5 rounded-[12px] border p-3 transition-colors duration-150 motion-reduce:transition-none",
                  isCorrect
                    ? "border-good bg-good-bg"
                    : selectedWrong
                      ? "border-bad bg-bad-bg"
                      : isSelected
                        ? "border-ink bg-brand-50"
                        : "border-[#DCDEE9] bg-surface",
                  locked ? "cursor-default" : "cursor-pointer hover:bg-surface-2",
                  !locked && isSelected && "hover:bg-brand-50",
                )}
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={option.id}
                  checked={isSelected}
                  disabled={locked}
                  onChange={() => onChoose(question.id, option.id)}
                  className="h-[18px] w-[18px] shrink-0 accent-ink"
                />
                <span
                  aria-hidden
                  className={cn(
                    "grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px] text-[12px] font-extrabold",
                    isCorrect
                      ? "bg-good text-white"
                      : selectedWrong
                        ? "bg-bad text-white"
                        : isSelected
                          ? "bg-ink text-white"
                          : "bg-surface-3 text-ink-soft",
                  )}
                >
                  {String.fromCharCode(65 + optionIndex)}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 break-words text-[15px] font-semibold",
                    isCorrect ? "text-good" : selectedWrong ? "text-bad" : "text-ink",
                  )}
                >
                  {option.text}
                </span>
                {isCorrect && (
                  <span className="sr-only">Correct answer</span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>
    </section>
  );
}

function AttachmentCard({ attachment }: { attachment: StudentAttachment }) {
  const isImage = attachment.contentType.startsWith("image/");
  const body = (
    <>
      {isImage && attachment.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={attachment.url}
          alt={attachment.fileName}
          className="h-24 w-full rounded-[10px] object-cover"
          loading="lazy"
        />
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[11px] bg-surface-3 text-ink-soft">
          {isImage ? (
            <ImageIcon className="h-5 w-5" aria-hidden />
          ) : (
            <FileText className="h-5 w-5" aria-hidden />
          )}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-ink">
          {attachment.fileName}
        </span>
        <span className="mt-0.5 block text-[12px] text-muted">
          {formatBytes(attachment.sizeBytes)}
        </span>
      </span>
    </>
  );

  return attachment.url ? (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-16 flex-wrap items-center gap-3 rounded-[12px] border border-line-strong bg-surface p-3 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      {body}
    </a>
  ) : (
    <div className="flex min-h-16 flex-wrap items-center gap-3 rounded-[12px] border border-line-strong bg-surface-2 p-3 text-muted">
      {body}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
