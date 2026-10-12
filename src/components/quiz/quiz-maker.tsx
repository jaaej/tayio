"use client";

import Link from "next/link";
import {
  useState,
  useTransition,
  type DragEvent,
  type ReactNode,
} from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  FileText,
  GripVertical,
  ImageIcon,
  Layers,
  ListChecks,
  Paperclip,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { ActionButtonLabel } from "@/components/ui/loading-button";
import {
  addOption,
  addQuestion,
  approveQuiz,
  deleteOption,
  deleteQuestion,
  deleteQuizAttachment,
  reorderQuestions,
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
import { QUIZ_STATUS_LABEL, QUIZ_STATUS_TONE } from "@/lib/quiz-status";
import { cn } from "@/lib/utils";

type Question = QuizWithContent["questions"][number];
type Option = Question["options"][number];
type ActionResult = { ok: true } | { ok: false; error: string };

const QUESTION_TYPE_LABEL: Record<string, string> = {
  multiple_choice: "Multiple choice",
  true_false: "True / False",
  context: "Context set",
};
const ATTACHMENT_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.ppt,.pptx,.txt";
const MAX_ATTACHMENTS = 6;
const MAX_UPLOAD_BATCH = 3;

// Status chip colours from the shared status tokens, so the chip follows
// whichever portal theme the maker renders in.
const STATUS_CHIP: Record<string, string> = {
  default: "bg-surface-3 text-muted",
  info: "bg-info-bg text-info",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad",
  good: "bg-good-bg text-good",
  brand: "bg-brand-50 text-brand-700",
};

// Shared control looks: glass buttons sit on a glass frame, line buttons on a
// white panel. Heights follow the kit: 36px in title rows, 42px in headers.
const GLASS_ICON_BTN =
  "grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-white/95 bg-white/65 text-ink transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-40";
const LINE_BTN =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-line-strong bg-surface px-3 text-[13px] font-bold text-ink transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-50";
const TEXT_BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-[9px] px-2.5 text-[13px] font-bold text-brand-600 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-50";
const FIELD =
  "w-full rounded-[12px] border border-line-strong bg-surface text-ink outline-none transition-colors placeholder:text-muted focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 disabled:opacity-60";

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

// Reorder handlers for a single card within its sibling group. Undefined when
// the group has only one member (nothing to reorder). Drag is the pointer path;
// the up/down buttons are the keyboard/assistive-tech path - both are always
// available together so reorder never depends on drag alone.
type ReorderHandlers = {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isDragging: boolean;
  disabled: boolean;
  dragHandle: {
    draggable: true;
    onDragStart: (event: DragEvent<HTMLElement>) => void;
    onDragEnd: () => void;
  };
  dropZone: {
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
  };
};

function useReorder(quizId: string, parentId: string | null, ids: string[]) {
  const { pending, run } = useActionRunner();
  const [dragId, setDragId] = useState<string | null>(null);

  function move(index: number, delta: number) {
    const next = [...ids];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    run(() => reorderQuestions({ quizId, parentId, orderedIds: next }));
  }

  function dropAt(fromId: string, toIndex: number) {
    const from = ids.indexOf(fromId);
    if (from === -1 || from === toIndex) return;
    const next = ids.filter((id) => id !== fromId);
    next.splice(toIndex, 0, fromId);
    run(() => reorderQuestions({ quizId, parentId, orderedIds: next }));
  }

  const enabled = ids.length > 1;

  function handlers(id: string, index: number): ReorderHandlers | undefined {
    if (!enabled) return undefined;
    return {
      canMoveUp: index > 0,
      canMoveDown: index < ids.length - 1,
      onMoveUp: () => move(index, -1),
      onMoveDown: () => move(index, 1),
      isDragging: dragId === id,
      disabled: pending,
      dragHandle: {
        draggable: true,
        onDragStart: (event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", id);
          setDragId(id);
        },
        onDragEnd: () => setDragId(null),
      },
      dropZone: {
        onDragOver: (event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        },
        onDrop: (event) => {
          event.preventDefault();
          if (dragId) dropAt(dragId, index);
          setDragId(null);
        },
      },
    };
  }

  return { pending, handlers };
}

/** A gradable question is ready when it has a prompt, at least two filled-in
 *  options, and exactly one correct answer. */
function isQuestionReady(question: Question): boolean {
  return (
    question.prompt.trim().length > 0 &&
    question.options.length >= 2 &&
    question.options.every((option) => option.text.trim().length > 0) &&
    question.options.filter((option) => option.isCorrect).length === 1
  );
}

function questionAnchor(id: string) {
  return `quiz-question-${id}`;
}

/**
 * The quiz editor shared by the admin and tutor portals: a glass header with
 * the title, status and the one primary action; an outline of the questions
 * beside the editor; one bezel per question. Role differences are props only.
 */
export function QuizMaker({
  quiz,
  questions,
  attachments,
  editable,
  canEditTitle,
  canSubmit,
  canApprove,
  hrefBack,
  backLabel = "Back",
  headerActions,
  note,
}: QuizWithContent & {
  editable: boolean;
  canEditTitle: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  hrefBack: string;
  /** Accessible name for the back button, e.g. "Back to quizzes". */
  backLabel?: string;
  /** Secondary actions shown before the primary action in the header. */
  headerActions?: ReactNode;
  /** Instructions or review feedback from the admin. */
  note?: { label: string; text: string; tone?: "bad" } | null;
}) {
  const { error: actionError, pending: actionPending, run } = useActionRunner();

  // Positions are sibling-scoped, so sort within each group. Top-level items
  // are questions with no parent; sub-questions are grouped by their parent.
  const topLevel = questions
    .filter((q) => q.parentId === null)
    .sort((a, b) => a.position - b.position);
  const childrenByParent = new Map<string, Question[]>();
  for (const q of questions) {
    if (q.parentId) {
      const list = childrenByParent.get(q.parentId) ?? [];
      list.push(q);
      childrenByParent.set(q.parentId, list);
    }
  }
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.position - b.position);
  }

  const attachmentsByQuestion = new Map<string, QuizAttachmentView[]>();
  for (const a of attachments) {
    if (a.questionId) {
      const list = attachmentsByQuestion.get(a.questionId) ?? [];
      list.push(a);
      attachmentsByQuestion.set(a.questionId, list);
    }
  }
  const generalAttachments = attachments.filter((a) => a.questionId === null);

  // Readiness reflects only gradable leaves; context sets are containers.
  const gradable = questions.filter((q) => q.type !== "context");
  const completeQuestions = gradable.filter(isQuestionReady).length;

  const topLevelIds = topLevel.map((q) => q.id);
  const topReorder = useReorder(quiz.id, null, topLevelIds);

  const primaryAction = canApprove
    ? {
        label: "Approve quiz",
        pendingLabel: "Approving…",
        run: () => approveQuiz({ quizId: quiz.id }),
      }
    : canSubmit
      ? {
          label: "Submit for review",
          pendingLabel: "Submitting…",
          run: () => submitQuiz({ quizId: quiz.id }),
        }
      : null;

  const statusTone = QUIZ_STATUS_TONE[quiz.status] ?? "default";

  return (
    <div className="flex flex-col gap-5">
      <header className="glass flex flex-wrap items-center justify-between gap-3.5 rounded-[24px] px-3.5 py-3">
        <div className="flex min-w-0 flex-[1_1_420px] items-center gap-3">
          <Link
            href={hrefBack}
            aria-label={backLabel}
            title={backLabel}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-white/95 bg-white/65 text-ink transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <ChevronLeft className="h-[17px] w-[17px]" strokeWidth={2.4} aria-hidden />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <TitleEditor
                quizId={quiz.id}
                title={quiz.title}
                editable={canEditTitle}
              />
              <span
                className={cn(
                  "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-extrabold",
                  STATUS_CHIP[statusTone] ?? STATUS_CHIP.default,
                )}
              >
                {QUIZ_STATUS_LABEL[quiz.status] ?? quiz.status}
              </span>
            </div>
            <p className="text-[13px] font-semibold text-ink-soft">
              {quiz.subjectName} · {quiz.termYear} Term {quiz.termNumber}, Week{" "}
              {quiz.weekNumber}
              {editable && (
                <span className="font-medium text-muted">
                  {" "}
                  · Changes save when you leave a field
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {headerActions}
          {primaryAction ? (
            <button
              type="button"
              disabled={actionPending}
              onClick={() => run(primaryAction.run)}
              className="inline-flex h-[42px] items-center justify-center gap-1.5 rounded-[12px] border border-ink bg-ink px-4 text-[14px] font-bold text-white transition-colors hover:bg-[#2b2847] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ActionButtonLabel
                pending={actionPending}
                pendingLabel={primaryAction.pendingLabel}
              >
                <>
                  <Check className="h-4 w-4" aria-hidden />
                  {primaryAction.label}
                </>
              </ActionButtonLabel>
            </button>
          ) : !editable ? (
            <span className="inline-flex h-[42px] items-center rounded-[12px] border border-white/95 bg-white/65 px-4 text-[13px] font-bold text-ink-soft">
              {quiz.status === "approved" ? "Approved and locked" : "Read only"}
            </span>
          ) : null}
        </div>
        {actionError && (
          <p
            role="alert"
            className="basis-full rounded-[10px] bg-bad-bg px-3 py-2 text-[13px] font-semibold text-bad"
          >
            {actionError}
          </p>
        )}
      </header>

      {note && note.text.trim().length > 0 && (
        <div className="rounded-[16px] bg-white/75 px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
          <strong
            className={cn("font-extrabold", note.tone === "bad" ? "text-bad" : "text-ink")}
          >
            {note.label}:
          </strong>{" "}
          <span className="whitespace-pre-wrap">{note.text}</span>
        </div>
      )}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <QuestionOutline
          topLevel={topLevel}
          childrenByParent={childrenByParent}
          ready={completeQuestions}
          total={gradable.length}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {topLevel.map((question, index) =>
            question.type === "context" ? (
              <ContextCard
                key={question.id}
                quizId={quiz.id}
                context={question}
                index={index}
                editable={editable}
                subQuestions={childrenByParent.get(question.id) ?? []}
                attachmentsByQuestion={attachmentsByQuestion}
                contextAttachments={attachmentsByQuestion.get(question.id) ?? []}
                totalAttachmentCount={attachments.length}
                reorder={topReorder.handlers(question.id, index)}
              />
            ) : (
              <QuestionCard
                key={question.id}
                quizId={quiz.id}
                displayLabel={String(index + 1)}
                question={question}
                editable={editable}
                attachments={attachmentsByQuestion.get(question.id) ?? []}
                totalAttachmentCount={attachments.length}
                reorder={topReorder.handlers(question.id, index)}
              />
            ),
          )}

          {generalAttachments.length > 0 && (
            <section
              aria-labelledby={`quiz-files-${quiz.id}`}
              className="glass rounded-[24px] p-1.5"
            >
              <h2
                id={`quiz-files-${quiz.id}`}
                className="px-3 pb-2.5 pt-2 text-[16px] font-extrabold text-ink"
              >
                Quiz files
              </h2>
              <div className="panel grid gap-2 p-3 sm:grid-cols-2">
                {generalAttachments.map((attachment) => (
                  <AttachmentRow
                    key={attachment.id}
                    attachment={attachment}
                    editable={false}
                    pending={false}
                    onDelete={() => {}}
                  />
                ))}
              </div>
            </section>
          )}

          <BuilderTools
            quizId={quiz.id}
            editable={editable}
            hasQuestions={topLevel.length > 0}
            pending={actionPending}
            run={run}
          />
        </div>
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

  if (!editable) {
    return (
      <h1 className="min-w-0 truncate text-[20px] font-extrabold leading-tight text-ink">
        {title}
      </h1>
    );
  }

  return (
    <div className="flex min-w-0 max-w-[460px] flex-1 flex-col">
      <h1 className="sr-only">{title}</h1>
      <label htmlFor={`quiz-title-${quizId}`} className="sr-only">
        Quiz name
      </label>
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
        className="-ml-2 h-8 min-w-0 rounded-[8px] border border-transparent bg-transparent px-2 text-[20px] font-extrabold text-ink outline-none transition-colors hover:bg-white/50 focus:border-white/95 focus:bg-white/80 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60"
      />
      {error && (
        <p role="alert" className="mt-1 text-[12px] font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

/** Jump list of the questions with a ready marker each, plus overall
 *  readiness. Every question stays on the page; the outline scrolls to it. */
function QuestionOutline({
  topLevel,
  childrenByParent,
  ready,
  total,
}: {
  topLevel: Question[];
  childrenByParent: Map<string, Question[]>;
  ready: number;
  total: number;
}) {
  const percent = total === 0 ? 0 : Math.round((ready / total) * 100);

  return (
    <nav
      aria-labelledby="quiz-outline-heading"
      className="glass flex shrink-0 flex-col rounded-[24px] p-1.5 lg:sticky lg:top-[var(--portal-sticky-top)] lg:w-[260px]"
    >
      <div className="flex flex-col gap-2 px-3 pb-2.5 pt-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2
            id="quiz-outline-heading"
            className="text-[16px] font-extrabold text-ink"
          >
            Questions
          </h2>
          {total > 0 && (
            <span className="text-[12px] font-bold tabular-nums text-ink-soft">
              {ready} of {total} ready
            </span>
          )}
        </div>
        <span
          role="progressbar"
          aria-label="Questions ready"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="block h-1.5 overflow-hidden rounded-full bg-white/80"
        >
          <span
            className="block h-full rounded-full bg-ink transition-[width] duration-200 motion-reduce:transition-none"
            style={{ width: `${percent}%` }}
          />
        </span>
      </div>
      {topLevel.length === 0 ? (
        <p className="panel px-3 py-4 text-[13px] text-muted">
          No questions yet.
        </p>
      ) : (
        <ol className="panel flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto p-1.5 lg:max-h-[calc(100vh-var(--portal-sticky-top)-140px)]">
          {topLevel.map((question, index) => {
            const isContext = question.type === "context";
            const children = childrenByParent.get(question.id) ?? [];
            const isReady = isContext
              ? children.length > 0 && children.every(isQuestionReady)
              : isQuestionReady(question);
            const text =
              question.prompt.trim() ||
              (isContext ? "Context set" : "Untitled question");
            return (
              <li key={question.id}>
                <a
                  href={`#${questionAnchor(question.id)}`}
                  className="flex items-center gap-2.5 rounded-[10px] p-2 text-ink transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px] bg-surface-3 text-[12px] font-extrabold text-ink-soft">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                    {isContext && (
                      <Layers
                        className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-muted"
                        aria-hidden
                      />
                    )}
                    {text}
                  </span>
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      isReady ? "bg-good" : "bg-warn",
                    )}
                    title={isReady ? "Ready" : "Needs work"}
                  />
                  <span className="sr-only">
                    {isReady ? "Ready" : "Needs work"}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}

const QUESTION_TYPES = [
  {
    type: "multiple_choice" as const,
    name: "Multiple choice",
    hint: "Two or more options",
    icon: ListChecks,
  },
  {
    type: "true_false" as const,
    name: "True / False",
    hint: "Two fixed answers",
    icon: CheckCircle2,
  },
  {
    type: "context" as const,
    name: "Context set",
    hint: "A passage with questions",
    icon: Layers,
  },
];

function BuilderTools({
  quizId,
  editable,
  hasQuestions,
  pending,
  run,
}: {
  quizId: string;
  editable: boolean;
  hasQuestions: boolean;
  pending: boolean;
  run: ReturnType<typeof useActionRunner>["run"];
}) {
  if (!editable) return null;

  return (
    <section aria-labelledby={`quiz-add-${quizId}`} className="flex flex-col gap-2.5">
      <h2
        id={`quiz-add-${quizId}`}
        className="pl-1 text-[14px] font-extrabold text-ink-soft"
      >
        {hasQuestions ? "Add another question" : "Add the first question"}
      </h2>
      <div
        className="grid gap-2.5"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))",
        }}
      >
        {QUESTION_TYPES.map(({ type, name, hint, icon: Icon }) => (
          <button
            key={type}
            type="button"
            disabled={pending}
            onClick={() => run(() => addQuestion({ quizId, type }))}
            className="glass flex items-center gap-3 rounded-[16px] px-3.5 py-3 text-left text-ink transition-transform duration-150 hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:hover:translate-y-0"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-surface">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="flex flex-col">
              <span className="text-[14px] font-extrabold">{name}</span>
              <span className="text-[12px] text-ink-soft">{hint}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

// Drag affordance for pointer users. Kept out of the tab order (aria-hidden)
// because the up/down buttons are the accessible reorder path.
function DragHandle({
  handle,
  disabled,
}: {
  handle: ReorderHandlers["dragHandle"];
  disabled: boolean;
}) {
  return (
    <span
      {...handle}
      draggable={!disabled}
      aria-hidden
      title="Drag to reorder"
      className={cn(
        "grid h-9 w-5 shrink-0 touch-none place-items-center transition-colors motion-reduce:transition-none",
        disabled
          ? "cursor-not-allowed text-muted opacity-30"
          : "cursor-grab text-muted hover:text-ink active:cursor-grabbing",
      )}
    >
      <GripVertical className="h-4 w-4" />
    </span>
  );
}

function MoveButtons({
  label,
  reorder,
  buttonClassName,
}: {
  label: string;
  reorder: ReorderHandlers;
  buttonClassName: string;
}) {
  return (
    <>
      <button
        type="button"
        aria-label={`Move ${label} up`}
        disabled={reorder.disabled || !reorder.canMoveUp}
        onClick={reorder.onMoveUp}
        className={buttonClassName}
      >
        <ChevronUp className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={`Move ${label} down`}
        disabled={reorder.disabled || !reorder.canMoveDown}
        onClick={reorder.onMoveDown}
        className={buttonClassName}
      >
        <ChevronDown className="h-4 w-4" aria-hidden />
      </button>
    </>
  );
}

/** Title row controls shared by question and context bezels. */
function CardControls({
  label,
  reorder,
  editable,
  pending,
  onDelete,
  buttonClassName,
}: {
  label: string;
  reorder?: ReorderHandlers;
  editable: boolean;
  pending: boolean;
  onDelete: () => void;
  buttonClassName: string;
}) {
  if (!reorder && !editable) return null;
  return (
    <div className="ml-auto flex shrink-0 items-center gap-1.5">
      {reorder && (
        <MoveButtons label={label} reorder={reorder} buttonClassName={buttonClassName} />
      )}
      {editable && (
        <button
          type="button"
          disabled={pending}
          aria-label={`Delete ${label}`}
          onClick={onDelete}
          className={cn(buttonClassName, "hover:text-bad")}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

function AttachmentManager({
  quizId,
  questionId,
  attachments,
  editable,
  totalCount,
}: {
  quizId: string;
  questionId: string;
  attachments: QuizAttachmentView[];
  editable: boolean;
  totalCount: number;
}) {
  const { error, setError, pending, run } = useActionRunner();
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [inputKey, setInputKey] = useState(0);
  const atLimit = totalCount >= MAX_ATTACHMENTS;

  if (!editable && attachments.length === 0) return null;

  function upload(formData: FormData) {
    const selected = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File && value.size > 0);
    if (selected.length > MAX_UPLOAD_BATCH) {
      setError(`Choose no more than ${MAX_UPLOAD_BATCH} files at once.`);
      return;
    }
    formData.set("quizId", quizId);
    formData.set("questionId", questionId);
    run(
      () => uploadQuizAttachments(formData),
      () => {
        setSelectedNames([]);
        setInputKey((current) => current + 1);
      },
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3.5">
      {attachments.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
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

      {editable && !atLimit && (
        <form
          action={upload}
          className="flex flex-wrap items-center justify-between gap-2.5"
        >
          <label
            className={cn(
              LINE_BTN,
              "cursor-pointer focus-within:ring-2 focus-within:ring-brand-400",
            )}
          >
            <Paperclip className="h-4 w-4" aria-hidden />
            Attach a file
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
          {selectedNames.length > 0 ? (
            <span className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
              <span className="min-w-0 truncate text-[12px] font-semibold text-ink-soft">
                {selectedNames.join(", ")}
              </span>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-9 items-center justify-center rounded-[10px] border border-ink bg-ink px-3.5 text-[13px] font-bold text-white transition-colors hover:bg-[#2b2847] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ActionButtonLabel pending={pending} pendingLabel="Uploading…">
                  Upload
                </ActionButtonLabel>
              </button>
            </span>
          ) : (
            <span className="text-[12px] text-muted">
              Images, PDFs, Office files or text · up to 10 MB each
            </span>
          )}
        </form>
      )}
      {editable && atLimit && (
        <p className="text-[12px] font-semibold text-muted">
          Quiz attachment limit reached.
        </p>
      )}
      {error && (
        <p role="alert" className="text-[12px] font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
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
    <div className="flex items-center gap-2.5 rounded-[12px] border border-line bg-surface p-2">
      {isImage && attachment.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={attachment.url}
          alt={attachment.fileName}
          className="h-10 w-10 shrink-0 rounded-[9px] object-cover"
          loading="lazy"
        />
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[9px] bg-surface-3 text-ink-soft">
          {isImage ? (
            <ImageIcon className="h-4 w-4" aria-hidden />
          ) : (
            <FileText className="h-4 w-4" aria-hidden />
          )}
        </span>
      )}
      <a
        href={attachment.url ?? undefined}
        target={attachment.url ? "_blank" : undefined}
        rel={attachment.url ? "noopener noreferrer" : undefined}
        className={cn(
          "min-w-0 flex-1",
          attachment.url ? "hover:text-brand-600" : "pointer-events-none",
        )}
      >
        <span className="block truncate text-[13px] font-bold text-ink">
          {attachment.fileName}
        </span>
        <span className="block text-[11px] font-semibold text-muted">
          {formatBytes(attachment.sizeBytes)}
        </span>
      </a>
      {editable && (
        <button
          type="button"
          aria-label={`Remove ${attachment.fileName}`}
          disabled={pending}
          onClick={onDelete}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] text-muted transition-colors hover:bg-bad-bg hover:text-bad focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

function QuestionCard({
  quizId,
  question,
  displayLabel,
  editable,
  attachments,
  totalAttachmentCount,
  reorder,
  nested = false,
}: {
  quizId: string;
  question: Question;
  displayLabel: string;
  editable: boolean;
  attachments: QuizAttachmentView[];
  totalAttachmentCount: number;
  reorder?: ReorderHandlers;
  /** A sub-question inside a context set: a bordered card, not a bezel. */
  nested?: boolean;
}) {
  const { error, pending, run } = useActionRunner();
  const isTrueFalse = question.type === "true_false";
  const promptId = `quiz-prompt-${question.id}`;
  const headingId = `quiz-heading-${question.id}`;
  const label = `question ${displayLabel}`;
  const Heading = nested ? "h3" : "h2";

  return (
    <article
      {...(reorder?.dropZone ?? {})}
      id={questionAnchor(question.id)}
      aria-labelledby={headingId}
      className={cn(
        "scroll-mt-[var(--portal-sticky-top)] transition-opacity",
        nested
          ? "rounded-[16px] border border-line bg-surface-2/60 p-1"
          : "glass rounded-[24px] p-1.5",
        reorder?.isDragging && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5 py-1.5 pl-3 pr-1.5">
        {reorder && (
          <DragHandle handle={reorder.dragHandle} disabled={reorder.disabled} />
        )}
        <Heading
          id={headingId}
          className={cn(
            "font-extrabold text-ink",
            nested ? "text-[14px]" : "text-[16px]",
          )}
        >
          Question {displayLabel}
        </Heading>
        <span className="inline-flex h-6 items-center rounded-full bg-surface px-2.5 text-[12px] font-bold text-ink-soft">
          {QUESTION_TYPE_LABEL[question.type] ?? question.type}
        </span>
        <CardControls
          label={label}
          reorder={reorder}
          editable={editable}
          pending={pending}
          buttonClassName={nested ? LINE_ICON_BTN : GLASS_ICON_BTN}
          onDelete={() => {
            if (!confirm(`Delete question ${displayLabel}? This cannot be undone.`)) {
              return;
            }
            run(() => deleteQuestion({ questionId: question.id }));
          }}
        />
      </div>

      <div
        className={cn(
          "flex flex-col gap-[18px] p-[18px]",
          nested ? "rounded-[13px] bg-surface" : "panel",
        )}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={promptId} className="text-[13px] font-bold text-ink">
            Question
          </label>
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
              className={cn(
                FIELD,
                "min-h-20 resize-y px-3.5 py-3 text-[15px] font-medium leading-relaxed",
              )}
            />
          ) : (
            <p
              id={promptId}
              className="text-[15px] font-medium leading-relaxed text-ink"
            >
              {question.prompt || <span className="text-muted">(no prompt)</span>}
            </p>
          )}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="pb-1 text-[13px] font-bold text-ink">
            Answers
            {editable && (
              <span className="font-medium text-muted"> · tick the correct one</span>
            )}
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

        <AttachmentManager
          quizId={quizId}
          questionId={question.id}
          attachments={attachments}
          editable={editable}
          totalCount={totalAttachmentCount}
        />

        {error && (
          <p role="alert" className="text-[12px] font-semibold text-bad">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}

const LINE_ICON_BTN =
  "grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-line-strong bg-surface text-ink transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-40";

// Sub-question labels stay letter-based (1a, 1b, ...) for the first 26
// entries, then fall back to a numeric suffix so labels never spill past "z".
function subQuestionLabel(childIndex: number): string {
  if (childIndex < 26) return String.fromCharCode(97 + childIndex);
  return `.${childIndex + 1}`;
}

function ContextCard({
  quizId,
  context,
  index,
  editable,
  subQuestions,
  attachmentsByQuestion,
  contextAttachments,
  totalAttachmentCount,
  reorder,
}: {
  quizId: string;
  context: Question;
  index: number;
  editable: boolean;
  subQuestions: Question[];
  attachmentsByQuestion: Map<string, QuizAttachmentView[]>;
  contextAttachments: QuizAttachmentView[];
  totalAttachmentCount: number;
  reorder?: ReorderHandlers;
}) {
  const { error, pending, run } = useActionRunner();
  const passageId = `quiz-passage-${context.id}`;
  const headingId = `quiz-heading-${context.id}`;
  const contextNumber = index + 1;

  const childIds = subQuestions.map((child) => child.id);
  const childReorder = useReorder(quizId, context.id, childIds);

  return (
    <article
      {...(reorder?.dropZone ?? {})}
      id={questionAnchor(context.id)}
      aria-labelledby={headingId}
      className={cn(
        "glass scroll-mt-[var(--portal-sticky-top)] rounded-[24px] p-1.5 transition-opacity",
        reorder?.isDragging && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5 py-1.5 pl-3 pr-1.5">
        {reorder && (
          <DragHandle handle={reorder.dragHandle} disabled={reorder.disabled} />
        )}
        <h2 id={headingId} className="text-[16px] font-extrabold text-ink">
          Question {contextNumber}
        </h2>
        <span className="inline-flex h-6 items-center gap-1 rounded-full bg-surface px-2.5 text-[12px] font-bold text-ink-soft">
          <Layers className="h-3.5 w-3.5" aria-hidden /> Context set
        </span>
        <CardControls
          label={`context set ${contextNumber}`}
          reorder={reorder}
          editable={editable}
          pending={pending}
          buttonClassName={GLASS_ICON_BTN}
          onDelete={() => {
            if (
              !confirm(
                `Delete context set ${contextNumber} and its ${subQuestions.length} sub-question(s)? This cannot be undone.`,
              )
            ) {
              return;
            }
            run(() => deleteQuestion({ questionId: context.id }));
          }}
        />
      </div>

      <div className="panel flex flex-col gap-[18px] p-[18px]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={passageId} className="text-[13px] font-bold text-ink">
            Passage
          </label>
          {editable ? (
            <textarea
              id={passageId}
              defaultValue={context.prompt}
              rows={3}
              maxLength={500}
              placeholder="Paste the passage, scenario, or shared context for the sub-questions"
              disabled={pending}
              onBlur={(event) => {
                const prompt = event.target.value;
                if (prompt === context.prompt) return;
                run(() =>
                  updateQuestionPrompt({ questionId: context.id, prompt }),
                );
              }}
              className={cn(
                FIELD,
                "min-h-24 resize-y px-3.5 py-3 text-[15px] font-medium leading-relaxed",
              )}
            />
          ) : (
            <p
              id={passageId}
              className="whitespace-pre-wrap text-[15px] font-medium leading-relaxed text-ink"
            >
              {context.prompt || <span className="text-muted">(no passage)</span>}
            </p>
          )}
        </div>

        <AttachmentManager
          quizId={quizId}
          questionId={context.id}
          attachments={contextAttachments}
          editable={editable}
          totalCount={totalAttachmentCount}
        />
        {error && (
          <p role="alert" className="text-[12px] font-semibold text-bad">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 border-t border-line pt-4">
          {subQuestions.length === 0 ? (
            <p className="rounded-[12px] border border-dashed border-line-strong px-4 py-4 text-center text-[13px] text-muted">
              No sub-questions yet.
            </p>
          ) : (
            subQuestions.map((child, childIndex) => (
              <QuestionCard
                key={child.id}
                quizId={quizId}
                displayLabel={`${contextNumber}${subQuestionLabel(childIndex)}`}
                question={child}
                editable={editable}
                attachments={attachmentsByQuestion.get(child.id) ?? []}
                totalAttachmentCount={totalAttachmentCount}
                reorder={childReorder.handlers(child.id, childIndex)}
                nested
              />
            ))
          )}

          {editable && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    addQuestion({
                      quizId,
                      type: "multiple_choice",
                      parentId: context.id,
                    }),
                  )
                }
                className={LINE_BTN}
              >
                <Plus className="h-4 w-4" aria-hidden /> Multiple choice sub-question
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    addQuestion({
                      quizId,
                      type: "true_false",
                      parentId: context.id,
                    }),
                  )
                }
                className={LINE_BTN}
              >
                <Plus className="h-4 w-4" aria-hidden /> True / False sub-question
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function AddOptionButton({ questionId }: { questionId: string }) {
  const { error, pending, run } = useActionRunner();
  return (
    <div className="pl-10">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => addOption({ questionId }))}
        className={TEXT_BTN}
      >
        <Plus className="h-4 w-4" aria-hidden /> Add option
      </button>
      {error && (
        <p role="alert" className="mt-1 text-[12px] font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

function optionLetter(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
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
  const letter = optionLetter(index);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-[12px] p-1 transition-colors motion-reduce:transition-none",
          option.isCorrect && "bg-good-bg/70",
        )}
      >
        {editable ? (
          <label className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full">
            <input
              type="radio"
              name={`quiz-correct-${questionId}`}
              checked={option.isCorrect}
              disabled={pending}
              onChange={() =>
                run(() => setCorrectOption({ questionId, optionId: option.id }))
              }
              aria-label={`Mark option ${letter} as the correct answer`}
              className="h-5 w-5 accent-good disabled:cursor-not-allowed"
            />
          </label>
        ) : (
          <span className="grid h-9 w-9 shrink-0 place-items-center">
            {option.isCorrect ? (
              <CheckCircle2 aria-label="Correct answer" className="h-5 w-5 text-good" />
            ) : (
              <span aria-hidden className="h-5 w-5 rounded-full border-2 border-line-strong" />
            )}
          </span>
        )}

        <span
          aria-hidden
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-[13px] font-extrabold",
            option.isCorrect ? "bg-good text-white" : "bg-surface-3 text-ink-soft",
          )}
        >
          {letter}
        </span>

        {showTextInput ? (
          <input
            defaultValue={option.text}
            maxLength={500}
            placeholder={`Option ${letter}`}
            disabled={pending}
            aria-label={`Option ${letter}`}
            onBlur={(event) => {
              const text = event.target.value;
              if (text === option.text) return;
              run(() => updateOption({ optionId: option.id, text }));
            }}
            className={cn(FIELD, "h-[42px] min-w-0 flex-1 rounded-[10px] px-3 text-[15px]")}
          />
        ) : (
          <span className="flex min-h-[42px] min-w-0 flex-1 items-center px-3 text-[15px] text-ink">
            {option.text || <span className="text-muted">(empty)</span>}
          </span>
        )}

        {editable && canDelete && (
          <button
            type="button"
            disabled={pending}
            aria-label={`Remove option ${letter}`}
            onClick={() => {
              if (!confirm(`Remove option ${letter}?`)) return;
              run(() => deleteOption({ optionId: option.id }));
            }}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] text-muted transition-colors hover:bg-bad-bg hover:text-bad focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 pl-10 text-[12px] font-semibold text-bad">
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
