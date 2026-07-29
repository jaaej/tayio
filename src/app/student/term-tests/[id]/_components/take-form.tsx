"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, ArrowLeft, FileText, ImageIcon, ListChecks } from "lucide-react";
import { submitTermTest } from "@/app/_actions/term-tests";
import type { StudentTermTest } from "@/lib/quiz-queries";

type Question = StudentTermTest["questions"][number];
type Attachment = StudentTermTest["attachments"][number];

export function TermTestTakeForm({
  content,
  hrefBack,
}: {
  content: StudentTermTest;
  hrefBack: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { quiz, questions, attachments } = content;

  const leafQuestions = questions.filter((question) => question.type !== "context");
  const answeredCount = leafQuestions.filter((question) => Boolean(answers[question.id])).length;
  const allAnswered = answeredCount === leafQuestions.length && leafQuestions.length > 0;

  const topLevel = questions
    .filter((question) => question.parentId === null)
    .sort((a, b) => a.position - b.position);
  const childrenByParent = new Map<string, Question[]>();
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

  const attachmentsByQuestion = new Map<string, Attachment[]>();
  for (const attachment of attachments) {
    if (attachment.questionId) {
      const list = attachmentsByQuestion.get(attachment.questionId) ?? [];
      list.push(attachment);
      attachmentsByQuestion.set(attachment.questionId, list);
    }
  }
  const generalAttachments = attachments.filter((attachment) => attachment.questionId === null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await submitTermTest({
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
        setConfirming(false);
        return;
      }
      router.refresh();
    });
  }

  function renderQuestion(question: Question, label: string) {
    const questionAttachments = attachmentsByQuestion.get(question.id) ?? [];
    return (
      <fieldset
        key={question.id}
        className="relative overflow-hidden rounded-[20px] border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,17,30,0.04),0_12px_28px_-22px_rgba(31,40,90,0.22)]"
      >
        <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-brand-500" />
        <legend className="w-full pt-1">
          <span className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-brand-100 text-[13px] font-extrabold text-brand-ink">
              {label}
            </span>
            <span className="min-w-0 flex-1 pt-1 text-[16px] font-extrabold leading-snug text-ink">
              {question.prompt}
            </span>
          </span>
        </legend>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {question.options.map((option) => {
            const selected = answers[question.id] === option.id;
            return (
              <label
                key={option.id}
                className={
                  "flex min-h-14 cursor-pointer items-center gap-3 rounded-[14px] border px-4 py-3 text-[14px] font-semibold transition-all duration-200 motion-reduce:transition-none " +
                  (selected
                    ? "border-brand-500 bg-brand-50 text-brand-ink shadow-[0_8px_18px_-14px_rgba(79,91,213,0.7)]"
                    : "border-line bg-background text-ink hover:border-brand-300 hover:bg-brand-50/50") +
                  (pending || confirming ? " cursor-default" : "")
                }
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={option.id}
                  checked={selected}
                  disabled={pending || confirming}
                  onChange={() =>
                    setAnswers((current) => ({ ...current, [question.id]: option.id }))
                  }
                  className="h-5 w-5 shrink-0 accent-brand-600"
                />
                <span className="flex-1">{option.text}</span>
              </label>
            );
          })}
        </div>

        {questionAttachments.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {questionAttachments.map((attachment) => (
              <AttachmentCard key={attachment.id} attachment={attachment} />
            ))}
          </div>
        )}
      </fieldset>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-5">
      <Link
        href={hrefBack}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[13px] font-bold text-brand-700 transition-colors hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {quiz.subjectName}
      </Link>

      <section className="relative overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#4F5BD5_0%,#3F4AB5_54%,#2B3287_100%)] px-5 py-6 text-white shadow-[0_18px_42px_-24px_rgba(31,40,90,0.72)] sm:px-7">
        <div
          aria-hidden
          className="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[38px] border-white/10"
        />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/75">
              {quiz.subjectName} - {quiz.termYear} Term {quiz.termNumber} - Term test
            </div>
            <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-[-0.025em] sm:text-[34px]">
              {quiz.title}
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] font-medium leading-relaxed text-white/80">
              You get one attempt at this test. Answer every question, then submit -
              you will not be able to change your answers afterwards.
            </p>
          </div>
          <div className="rounded-[18px] border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-[12px] font-bold text-white/80">
              <ListChecks className="h-4 w-4" />
              Progress
            </div>
            <div className="mt-2 text-[28px] font-extrabold tabular-nums">
              {answeredCount}/{leafQuestions.length}
            </div>
            <div className="text-[11px] font-semibold text-white/70">questions answered</div>
          </div>
        </div>
      </section>

      {generalAttachments.length > 0 && (
        <section className="rounded-[20px] border border-line bg-surface p-5 shadow-[0_8px_24px_-20px_rgba(31,40,90,0.2)]">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand-600" />
            <h2 className="text-[14px] font-extrabold text-ink">Test materials</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {generalAttachments.map((attachment) => (
              <AttachmentCard key={attachment.id} attachment={attachment} />
            ))}
          </div>
        </section>
      )}

      <div className="space-y-4">
        {topLevel.map((question, index) => {
          const displayNumber = index + 1;
          if (question.type === "context") {
            const children = childrenByParent.get(question.id) ?? [];
            const passageAttachments = attachmentsByQuestion.get(question.id) ?? [];
            return (
              <div key={question.id} className="space-y-4">
                <section className="relative overflow-hidden rounded-[20px] border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,17,30,0.04),0_12px_28px_-22px_rgba(31,40,90,0.22)]">
                  <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-brand-300" />
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-brand-100 text-[13px] font-extrabold text-brand-ink">
                      {displayNumber}
                    </span>
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted">
                        Passage
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-[15px] font-semibold leading-relaxed text-ink">
                        {question.prompt}
                      </p>
                    </div>
                  </div>
                  {passageAttachments.length > 0 && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {passageAttachments.map((attachment) => (
                        <AttachmentCard key={attachment.id} attachment={attachment} />
                      ))}
                    </div>
                  )}
                </section>
                {children.map((child, childIndex) =>
                  renderQuestion(child, `${displayNumber}${String.fromCharCode(97 + childIndex)}`),
                )}
              </div>
            );
          }
          return renderQuestion(question, String(displayNumber));
        })}
      </div>

      <section className="sticky bottom-3 z-10 rounded-[20px] border border-line bg-surface/95 p-4 shadow-[0_20px_50px_-24px_rgba(31,40,90,0.45)] backdrop-blur">
        {confirming ? (
          <div aria-live="polite" className="space-y-3">
            <div className="flex items-start gap-2.5 rounded-[14px] bg-warn-bg px-3.5 py-3 text-warn">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-[13px] font-bold leading-snug">
                This is your only attempt. Once you submit, you cannot change any
                answer.
                {!allAnswered &&
                  ` You have answered ${answeredCount} of ${leafQuestions.length} questions - unanswered questions count as wrong.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={submit}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-600 px-6 text-[13px] font-bold text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Submitting..." : "Yes, submit my test"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirming(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 text-[13px] font-bold text-ink transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Keep reviewing
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-muted">
                {answeredCount} of {leafQuestions.length} answered
              </div>
              <div className="text-[11px] font-semibold text-muted">
                One attempt only - review your answers before submitting.
              </div>
            </div>
            <button
              type="button"
              disabled={leafQuestions.length === 0}
              onClick={() => setConfirming(true)}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-600 px-6 text-[13px] font-bold text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Submit test
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-2 text-[13px] font-semibold text-bad">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}

function AttachmentCard({ attachment }: { attachment: Attachment }) {
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
        <span className="grid h-12 w-12 place-items-center rounded-[12px] bg-brand-100 text-brand-700">
          {isImage ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-bold text-ink">
          {attachment.fileName}
        </span>
        <span className="mt-0.5 block text-[10px] font-semibold text-muted">
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
      className="flex min-h-16 items-center gap-3 rounded-[14px] border border-line bg-background p-3 transition-colors hover:border-brand-300 hover:bg-brand-50"
    >
      {body}
    </a>
  ) : (
    <div className="flex min-h-16 items-center gap-3 rounded-[14px] border border-line bg-background p-3 opacity-70">
      {body}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
