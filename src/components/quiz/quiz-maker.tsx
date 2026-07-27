"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  FileText,
  ImageIcon,
  ListChecks,
  Paperclip,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import {
  addOption,
  addQuestion,
  approveQuiz,
  deleteOption,
  deleteQuestion,
  deleteQuizAttachment,
  setCorrectOption,
  submitQuiz,
  updateOption,
  updateQuestionPrompt,
  updateQuizTitle,
  uploadQuizAttachments,
} from "@/app/_actions/quizzes";
import type {
  QuizAttachmentView,
  QuizWithContent,
} from "@/lib/quiz-queries";
import { QUIZ_STATUS_LABEL } from "@/lib/quiz-status";

type Question = QuizWithContent["questions"][number];
type Option = Question["options"][number];
type ActionResult = { ok: true } | { ok: false; error: string };

const QUESTION_TYPE_LABEL: Record<string, string> = {
  multiple_choice: "Multiple choice",
  true_false: "True / False",
};
const ATTACHMENT_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.ppt,.pptx,.txt";
const MAX_ATTACHMENTS = 6;
const MAX_UPLOAD_BATCH = 3;

function useActionRunner() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(
    action: () => Promise<ActionResult>,
    onSuccess?: () => void,
    onError?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error);
          onError?.();
          return;
        }
        onSuccess?.();
      } catch {
        setError("That change could not be saved. Please try again.");
        onError?.();
      }
    });
  }

  return { error, setError, pending, run };
}

export function QuizMaker({
  quiz,
  questions,
  attachments,
  editable,
  canEditTitle,
  canSubmit,
  canApprove,
  hrefBack,
}: QuizWithContent & {
  editable: boolean;
  canEditTitle: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  hrefBack: string;
}) {
  const { error: actionError, pending: actionPending, run } = useActionRunner();
  const optionCount = questions.reduce(
    (total, question) => total + question.options.length,
    0,
  );
  const completeQuestions = questions.filter(
    (question) =>
      question.prompt.trim().length > 0 &&
      question.options.length >= 2 &&
      question.options.every((option) => option.text.trim().length > 0) &&
      question.options.filter((option) => option.isCorrect).length === 1,
  ).length;

  const primaryAction = canApprove
    ? {
        label: actionPending ? "Approving..." : "Approve quiz",
        run: () => approveQuiz({ quizId: quiz.id }),
      }
    : canSubmit
      ? {
          label: actionPending ? "Submitting..." : "Submit for review",
          run: () => submitQuiz({ quizId: quiz.id }),
        }
      : null;

  return (
    <div className="space-y-5">
      <Link
        href={hrefBack}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[13px] font-bold text-brand-700 transition-colors hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <ArrowLeft className="h-4 w-4" /> Back to quizzes
      </Link>

      <section className="relative overflow-hidden rounded-[22px] border border-brand-200 bg-[linear-gradient(135deg,#F3F4FF_0%,#FFFFFF_48%,#EEF0FF_100%)] p-5 shadow-[0_16px_38px_-28px_rgba(31,40,90,0.42)] sm:p-6">
        <div
          aria-hidden
          className="absolute -right-12 -top-16 h-48 w-48 rounded-full border-[32px] border-brand-200/40"
        />
        <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white">
                <ListChecks className="h-3.5 w-3.5" /> Quiz workspace
              </span>
              <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                {QUIZ_STATUS_LABEL[quiz.status] ?? quiz.status}
              </span>
            </div>
            <TitleEditor
              quizId={quiz.id}
              title={quiz.title}
              editable={canEditTitle}
            />
            <p className="mt-2 text-[12px] font-semibold text-muted">
              {quiz.subjectName} - {quiz.termYear} Term {quiz.termNumber}, Week{" "}
              {quiz.weekNumber}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Metric value={questions.length} label="Questions" />
            <Metric value={optionCount} label="Options" />
            <Metric
              value={`${completeQuestions}/${questions.length}`}
              label="Ready"
            />
          </div>
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 px-1">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-700">
                Question canvas
              </div>
              <h2 className="mt-1 text-[20px] font-extrabold tracking-[-0.02em] text-ink">
                Build the quiz
              </h2>
            </div>
            <span className="text-[12px] font-semibold text-muted">
              Changes save when you leave a field
            </span>
          </div>

          {questions.length === 0 ? (
            <div className="grid min-h-64 place-items-center rounded-[22px] border-2 border-dashed border-brand-200 bg-brand-50/50 p-7 text-center">
              <div>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-[16px] bg-brand-100 text-brand-700">
                  <Sparkles className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-[18px] font-extrabold text-ink">
                  Start with your first question
                </h3>
                <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-muted">
                  Use the builder tools to add multiple-choice or true/false
                  questions. You can attach supporting files in the same panel.
                </p>
              </div>
            </div>
          ) : (
            questions.map((question, index) => (
              <QuestionCard
                key={question.id}
                index={index}
                question={question}
                editable={editable}
              />
            ))
          )}
        </main>

        <aside className="space-y-4 xl:sticky xl:top-4">
          <BuilderTools
            quizId={quiz.id}
            editable={editable}
            pending={actionPending}
            run={run}
          />
          <AttachmentManager
            quizId={quiz.id}
            attachments={attachments}
            editable={editable}
          />

          <section className="rounded-[20px] border border-line bg-surface p-4 shadow-[0_14px_32px_-26px_rgba(31,40,90,0.36)]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-brand-600" />
              <h2 className="text-[14px] font-extrabold text-ink">
                Quiz readiness
              </h2>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-brand-600 transition-[width] duration-200 motion-reduce:transition-none"
                style={{
                  width:
                    questions.length === 0
                      ? "0%"
                      : `${Math.round((completeQuestions / questions.length) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-2 text-[11px] font-semibold leading-relaxed text-muted">
              {questions.length === 0
                ? "Add a question to begin."
                : `${completeQuestions} of ${questions.length} questions have a prompt, options, and one correct answer.`}
            </p>

            {primaryAction ? (
              <button
                type="button"
                disabled={actionPending}
                onClick={() => run(primaryAction.run)}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 text-[13px] font-bold text-white shadow-[0_12px_24px_-16px_rgba(79,91,213,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-[0_16px_28px_-16px_rgba(79,91,213,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <Check className="h-4 w-4" />
                {primaryAction.label}
              </button>
            ) : (
              <div className="mt-4 rounded-[12px] bg-surface-2 px-3 py-2.5 text-center text-[12px] font-bold text-muted">
                {quiz.status === "approved"
                  ? "Approved quizzes are locked"
                  : "No action is available for this status"}
              </div>
            )}
            {actionError && (
              <p role="alert" className="mt-2 text-[12px] font-semibold text-bad">
                {actionError}
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function TitleEditor({
  quizId,
  title,
  editable,
}: {
  quizId: string;
  title: string;
  editable: boolean;
}) {
  const { error, pending, run } = useActionRunner();

  return (
    <div className="mt-4">
      <label
        htmlFor={`quiz-title-${quizId}`}
        className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted"
      >
        Quiz name
      </label>
      {editable ? (
        <input
          id={`quiz-title-${quizId}`}
          defaultValue={title}
          maxLength={200}
          disabled={pending}
          onBlur={(event) => {
            const input = event.currentTarget;
            const nextTitle = event.target.value.trim();
            if (!nextTitle) {
              input.value = title;
              return;
            }
            input.value = nextTitle;
            if (nextTitle === title) return;
            run(
              () => updateQuizTitle({ quizId, title: nextTitle }),
              undefined,
              () => {
                input.value = title;
              },
            );
          }}
          className="mt-1 min-h-12 w-full max-w-3xl rounded-[14px] border border-brand-200 bg-white/90 px-4 py-2 text-[22px] font-extrabold tracking-[-0.02em] text-ink outline-none transition-colors placeholder:text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 disabled:opacity-60 sm:text-[26px]"
        />
      ) : (
        <h1
          id={`quiz-title-${quizId}`}
          className="mt-1 text-[26px] font-extrabold tracking-[-0.025em] text-ink sm:text-[30px]"
        >
          {title}
        </h1>
      )}
      {error && (
        <p role="alert" className="mt-1 text-[12px] font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-[14px] border border-white/80 bg-white/75 px-3 py-3 text-center shadow-[0_8px_20px_-18px_rgba(31,40,90,0.38)]">
      <div className="text-[20px] font-extrabold tracking-[-0.02em] text-ink tabular-nums">
        {value}
      </div>
      <div className="mt-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted">
        {label}
      </div>
    </div>
  );
}

function BuilderTools({
  quizId,
  editable,
  pending,
  run,
}: {
  quizId: string;
  editable: boolean;
  pending: boolean;
  run: ReturnType<typeof useActionRunner>["run"];
}) {
  if (!editable) return null;

  return (
    <section className="rounded-[20px] border border-line bg-surface p-4 shadow-[0_14px_32px_-26px_rgba(31,40,90,0.36)]">
      <div className="flex items-center gap-2">
        <Plus className="h-4 w-4 text-brand-600" />
        <h2 className="text-[14px] font-extrabold text-ink">Add a question</h2>
      </div>
      <p className="mt-1 text-[11px] font-semibold leading-relaxed text-muted">
        Pick a format. New questions appear at the end of the canvas.
      </p>
      <div className="mt-3 grid gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() =>
              addQuestion({ quizId, type: "multiple_choice" }),
            )
          }
          className="flex min-h-12 items-center gap-3 rounded-[14px] border border-line bg-background px-3 text-left transition-all duration-200 hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
        >
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-brand-100 text-brand-700">
            <ListChecks className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-[12px] font-extrabold text-ink">
              Multiple choice
            </span>
            <span className="block text-[10px] font-semibold text-muted">
              Two or more options
            </span>
          </span>
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => addQuestion({ quizId, type: "true_false" }))
          }
          className="flex min-h-12 items-center gap-3 rounded-[14px] border border-line bg-background px-3 text-left transition-all duration-200 hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
        >
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-brand-100 text-brand-700">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-[12px] font-extrabold text-ink">
              True / False
            </span>
            <span className="block text-[10px] font-semibold text-muted">
              Ready-made answer pair
            </span>
          </span>
        </button>
      </div>
    </section>
  );
}

function AttachmentManager({
  quizId,
  attachments,
  editable,
}: {
  quizId: string;
  attachments: QuizAttachmentView[];
  editable: boolean;
}) {
  const { error, setError, pending, run } = useActionRunner();
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [inputKey, setInputKey] = useState(0);

  function upload(formData: FormData) {
    const selected = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File && value.size > 0);
    if (selected.length > MAX_UPLOAD_BATCH) {
      setError(`Choose no more than ${MAX_UPLOAD_BATCH} files at once.`);
      return;
    }
    formData.set("quizId", quizId);
    run(
      () => uploadQuizAttachments(formData),
      () => {
        setSelectedNames([]);
        setInputKey((current) => current + 1);
      },
    );
  }

  return (
    <section className="rounded-[20px] border border-line bg-surface p-4 shadow-[0_14px_32px_-26px_rgba(31,40,90,0.36)]">
      <div className="flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-brand-600" />
        <h2 className="text-[14px] font-extrabold text-ink">Attachments</h2>
        <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-muted tabular-nums">
          {attachments.length}/{MAX_ATTACHMENTS}
        </span>
      </div>
      <p className="mt-1 text-[11px] font-semibold leading-relaxed text-muted">
        Add images, PDFs, Office files, or text notes. 10 MB per file.
      </p>

      {attachments.length > 0 && (
        <div className="mt-3 space-y-2">
          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              attachment={attachment}
              editable={editable}
              pending={pending}
              onDelete={() => {
                if (!confirm(`Remove "${attachment.fileName}"?`)) return;
                run(() =>
                  deleteQuizAttachment({ attachmentId: attachment.id }),
                );
              }}
            />
          ))}
        </div>
      )}

      {editable && attachments.length < MAX_ATTACHMENTS && (
        <form
          action={upload}
          className="mt-3 rounded-[14px] border-2 border-dashed border-brand-200 bg-brand-50/50 p-3"
        >
          <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[10px] text-[12px] font-bold text-brand-700 transition-colors hover:bg-brand-100">
            <Upload className="h-4 w-4" />
            Choose files
            <input
              key={inputKey}
              name="files"
              type="file"
              multiple
              accept={ATTACHMENT_ACCEPT}
              className="sr-only"
              onChange={(event) =>
                setSelectedNames(
                  Array.from(event.target.files ?? []).map((file) => file.name),
                )
              }
            />
          </label>
          {selectedNames.length > 0 && (
            <div className="mt-2 space-y-2">
              <p className="line-clamp-2 text-[10px] font-semibold text-muted">
                {selectedNames.join(", ")}
              </p>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-brand-600 px-4 text-[12px] font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Uploading..." : "Upload selected"}
              </button>
            </div>
          )}
        </form>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[11px] font-semibold text-bad">
          {error}
        </p>
      )}
    </section>
  );
}

function AttachmentRow({
  attachment,
  editable,
  pending,
  onDelete,
}: {
  attachment: QuizAttachmentView;
  editable: boolean;
  pending: boolean;
  onDelete: () => void;
}) {
  const isImage = attachment.contentType.startsWith("image/");
  return (
    <div className="flex items-center gap-2 rounded-[12px] border border-line bg-background p-2">
      {isImage && attachment.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={attachment.url}
          alt={attachment.fileName}
          className="h-10 w-10 shrink-0 rounded-[9px] object-cover"
          loading="lazy"
        />
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[9px] bg-brand-100 text-brand-700">
          {isImage ? (
            <ImageIcon className="h-4 w-4" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </span>
      )}
      <a
        href={attachment.url ?? undefined}
        target={attachment.url ? "_blank" : undefined}
        rel={attachment.url ? "noopener noreferrer" : undefined}
        className={
          "min-w-0 flex-1 " +
          (attachment.url ? "hover:text-brand-700" : "pointer-events-none")
        }
      >
        <span className="block truncate text-[11px] font-bold text-ink">
          {attachment.fileName}
        </span>
        <span className="block text-[9px] font-semibold text-muted">
          {formatBytes(attachment.sizeBytes)}
        </span>
      </a>
      {editable && (
        <button
          type="button"
          aria-label={`Remove ${attachment.fileName}`}
          disabled={pending}
          onClick={onDelete}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-bad transition-colors hover:bg-bad-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bad disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
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
  const { error, pending, run } = useActionRunner();
  const isTrueFalse = question.type === "true_false";
  const promptId = `quiz-prompt-${question.id}`;

  return (
    <article className="group relative overflow-hidden rounded-[22px] border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,17,30,0.04),0_12px_28px_-24px_rgba(31,40,90,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-24px_rgba(31,40,90,0.3)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-6">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1 bg-brand-500"
      />
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-brand-100 text-[13px] font-extrabold text-brand-ink">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={promptId}
              className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted"
            >
              Question prompt
            </label>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-ink">
              {QUESTION_TYPE_LABEL[question.type] ?? question.type}
            </span>
          </div>
          {editable ? (
            <textarea
              id={promptId}
              defaultValue={question.prompt}
              rows={2}
              maxLength={500}
              placeholder="Write a clear question"
              disabled={pending}
              onBlur={(event) => {
                const prompt = event.target.value;
                if (prompt === question.prompt) return;
                run(() =>
                  updateQuestionPrompt({ questionId: question.id, prompt }),
                );
              }}
              className="mt-2 min-h-20 w-full resize-y rounded-[14px] border border-line bg-background px-4 py-3 text-[15px] font-semibold leading-relaxed text-ink outline-none transition-colors placeholder:text-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 disabled:opacity-60"
            />
          ) : (
            <p
              id={promptId}
              className="mt-2 min-h-12 py-2 text-[15px] font-semibold leading-relaxed text-ink"
            >
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
              if (!confirm(`Delete question ${index + 1}? This cannot be undone.`)) {
                return;
              }
              run(() => deleteQuestion({ questionId: question.id }));
            }}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-bad transition-colors hover:bg-bad-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bad disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>

      <fieldset className="mt-5">
        <legend className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
          Answers - choose the correct option
        </legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
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
        </div>
        {editable && !isTrueFalse && (
          <AddOptionButton questionId={question.id} />
        )}
      </fieldset>

      {error && (
        <p role="alert" className="mt-3 text-[12px] font-semibold text-bad">
          {error}
        </p>
      )}
    </article>
  );
}

function AddOptionButton({ questionId }: { questionId: string }) {
  const { error, pending, run } = useActionRunner();
  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => addOption({ questionId }))}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-brand-300 px-4 text-[12px] font-bold text-brand-700 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-4 w-4" /> Add option
      </button>
      {error && (
        <p role="alert" className="mt-1 text-[11px] font-semibold text-bad">
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
  const { error, pending, run } = useActionRunner();
  const showTextInput = editable && !locked;

  return (
    <div>
      <div
        className={
          "flex min-h-14 items-center gap-2 rounded-[14px] border px-2.5 py-2 transition-colors " +
          (option.isCorrect
            ? "border-brand-300 bg-brand-50"
            : "border-line bg-background")
        }
      >
        {editable ? (
          <label className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full">
            <input
              type="radio"
              name={`quiz-correct-${questionId}`}
              checked={option.isCorrect}
              disabled={pending}
              onChange={() =>
                run(() =>
                  setCorrectOption({ questionId, optionId: option.id }),
                )
              }
              aria-label={`Mark option ${index + 1} as the correct answer`}
              className="h-5 w-5 accent-brand-600 disabled:cursor-not-allowed"
            />
          </label>
        ) : (
          <span className="grid h-11 w-11 shrink-0 place-items-center">
            {option.isCorrect ? (
              <CheckCircle2
                aria-label="Correct answer"
                className="h-5 w-5 text-brand-600"
              />
            ) : (
              <span
                aria-hidden
                className="h-5 w-5 rounded-full border-2 border-line"
              />
            )}
          </span>
        )}

        {showTextInput ? (
          <input
            defaultValue={option.text}
            maxLength={500}
            placeholder={`Option ${index + 1}`}
            disabled={pending}
            aria-label={`Option ${index + 1} text`}
            onBlur={(event) => {
              const text = event.target.value;
              if (text === option.text) return;
              run(() => updateOption({ optionId: option.id, text }));
            }}
            className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-transparent bg-transparent px-2.5 py-2 text-[13px] font-semibold text-ink outline-none transition-colors placeholder:text-muted focus:border-brand-300 focus:bg-white disabled:opacity-60"
          />
        ) : (
          <span className="min-w-0 flex-1 px-2.5 py-2 text-[13px] font-semibold text-ink">
            {option.text || <span className="text-muted">(empty)</span>}
          </span>
        )}

        {editable && canDelete && (
          <button
            type="button"
            disabled={pending}
            aria-label={`Delete option ${index + 1}`}
            onClick={() => {
              if (!confirm(`Remove option ${index + 1}?`)) return;
              run(() => deleteOption({ optionId: option.id }));
            }}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-bad transition-colors hover:bg-bad-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bad disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-[10px] font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
