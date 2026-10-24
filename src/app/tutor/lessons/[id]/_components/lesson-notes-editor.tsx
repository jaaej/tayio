"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Button, Empty } from "@/components/admin/ui";
import { ActionSpinner } from "@/components/ui/loading-button";
import { saveLessonNote } from "@/app/tutor/_actions";
import { formatDateTime } from "@/lib/format";
import { LESSON_NOTE_SHARED_FIELDS, NOTE_VISIBILITY } from "@/lib/lesson-note-fields";
import { cn } from "@/lib/utils";

export const NOTE_FIELDS = [
  "topicCovered",
  "performance",
  "strengths",
  "struggles",
  "nextLessonFocus",
  "parentVisibleComment",
  "internalNote",
] as const;

export type NoteField = (typeof NOTE_FIELDS)[number];
export type NoteValues = Record<NoteField, string>;

export type NoteStudent = {
  id: string;
  name: string;
  isMakeup: boolean;
  /** Marked absent (or moved out of this lesson): no note is needed. */
  absent: boolean;
  /** The saved note, or null when none has been written yet. */
  note: NoteValues | null;
  savedAt: string | null;
};

const EMPTY: NoteValues = {
  topicCovered: "",
  performance: "",
  strengths: "",
  struggles: "",
  nextLessonFocus: "",
  parentVisibleComment: "",
  internalNote: "",
};

const LABEL = Object.fromEntries(
  LESSON_NOTE_SHARED_FIELDS.map((field) => [field.key, field.label]),
) as Record<(typeof LESSON_NOTE_SHARED_FIELDS)[number]["key"], string>;

const FIELD_CLS =
  "w-full rounded-[10px] border border-line-strong bg-surface px-2.5 text-[14px] text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10";

/**
 * Lesson notes: pick a student from the tabs and fill in one form. Drafts are
 * kept per student, so switching tabs never loses typing; "Save & next
 * student" saves and moves to the next tab.
 */
export function LessonNotesEditor({
  lessonId,
  students,
}: {
  lessonId: string;
  students: NoteStudent[];
}) {
  const router = useRouter();
  const headingId = useId();
  const formId = useId();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(
    () =>
      (
        students.find((s) => !s.absent && !s.note) ??
        students.find((s) => !s.absent) ??
        students[0]
      )?.id ?? null,
  );
  const [saved, setSaved] = useState<Record<string, { note: NoteValues | null; savedAt: string | null }>>(
    () => Object.fromEntries(students.map((s) => [s.id, { note: s.note, savedAt: s.savedAt }])),
  );
  const [drafts, setDrafts] = useState<Record<string, NoteValues>>(() =>
    Object.fromEntries(students.map((s) => [s.id, s.note ?? EMPTY])),
  );
  const [result, setResult] = useState<"saved" | "error" | null>(null);

  // Absent students need no note, so the count leaves them out.
  const needed = students.filter((s) => !s.absent);
  const writtenCount = needed.filter((s) => saved[s.id]?.note).length;

  if (students.length === 0 || !selectedId) {
    return (
      <section aria-labelledby={headingId} className="glass rounded-[24px] p-1.5">
        <div className="flex min-h-12 items-center py-1.5 pl-3 pr-1.5">
          <h2 id={headingId} className="text-[16px] font-extrabold text-ink">
            Lesson notes
          </h2>
        </div>
        <div className="panel">
          <Empty>No students to write notes for.</Empty>
        </div>
      </section>
    );
  }

  const index = students.findIndex((s) => s.id === selectedId);
  const student = students[index];
  const draft = drafts[student.id];
  const savedEntry = saved[student.id];
  const dirty = NOTE_FIELDS.some((f) => draft[f] !== (savedEntry.note ?? EMPTY)[f]);
  const next = students[index + 1] ?? null;

  function select(id: string) {
    setSelectedId(id);
    setResult(null);
  }

  function update(field: NoteField, value: string) {
    setResult(null);
    setDrafts((prev) => ({ ...prev, [student.id]: { ...prev[student.id], [field]: value } }));
  }

  function save(goNext: boolean) {
    const formData = new FormData();
    formData.set("lessonId", lessonId);
    formData.set("studentId", student.id);
    for (const f of NOTE_FIELDS) formData.set(f, draft[f]);
    const savedFor = student.id;
    const values = { ...draft };
    setResult(null);
    startTransition(async () => {
      try {
        await saveLessonNote(formData);
      } catch {
        setResult("error");
        return;
      }
      setSaved((prev) => ({
        ...prev,
        [savedFor]: { note: values, savedAt: new Date().toISOString() },
      }));
      if (goNext && next) setSelectedId(next.id);
      setResult(goNext && next ? null : "saved");
      router.refresh();
    });
  }

  const firstName = (name: string) => name.split(" ")[0] || name;

  return (
    <section aria-labelledby={headingId} className="glass rounded-[24px] p-1.5">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-2.5 py-1.5 pl-3 pr-1.5">
        <h2 id={headingId} className="text-[16px] font-extrabold text-ink">
          Lesson notes{" "}
          {needed.length > 0 && (
            <span className="text-[13px] font-semibold tabular-nums text-ink-soft">
              · {writtenCount} of {needed.length} written
            </span>
          )}
        </h2>
        <div role="tablist" aria-label="Student" className="flex flex-wrap gap-1">
          {students.map((s) => {
            const on = s.id === student.id;
            const written = Boolean(saved[s.id]?.note);
            const state = s.absent
              ? written
                ? "absent, note written"
                : "absent, no note needed"
              : written
                ? "note written"
                : "no note yet";
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                id={`${formId}-tab-${s.id}`}
                aria-selected={on}
                aria-controls={`${formId}-panel`}
                onClick={() => select(s.id)}
                title={`${s.name}${s.isMakeup ? " (make-up)" : ""} - ${state}`}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-bold transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                  on
                    ? "border-ink bg-ink text-white"
                    : "border-white/95 bg-white/70 text-ink hover:bg-white",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-[7px] w-[7px] rounded-full",
                    written ? "bg-[#16A34A]" : s.absent ? "bg-[#B4B2C2]" : "bg-[#E8890C]",
                  )}
                />
                {firstName(s.name)}
                {s.absent && (
                  <span className={cn("font-semibold", on ? "text-white/75" : "text-muted")}>Absent</span>
                )}
                <span className="sr-only">, {state}</span>
              </button>
            );
          })}
        </div>
      </div>

      <form
        id={`${formId}-panel`}
        role="tabpanel"
        aria-labelledby={`${formId}-tab-${student.id}`}
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
        className="panel flex flex-wrap gap-3 p-2.5 sm:gap-3.5 sm:p-4"
      >
        <div
          role="group"
          aria-labelledby={`${formId}-shared`}
          className="flex min-w-0 flex-[999_1_420px] flex-col gap-3 rounded-[14px] bg-[#F2FAF6] p-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <span id={`${formId}-shared`} className="text-[13px] font-extrabold text-good">
              {NOTE_VISIBILITY.shared}
            </span>
            <span className="truncate text-[12px] text-muted">
              {student.name}
              {student.isMakeup ? " · Make-up attendee" : ""}
              {student.absent ? " · Absent" : ""}
            </span>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label={LABEL.topicCovered} value={draft.topicCovered} onChange={(v) => update("topicCovered", v)} placeholder="e.g. Quadratic equations" />
            <Field label={LABEL.performance} value={draft.performance} onChange={(v) => update("performance", v)} placeholder="e.g. Engaged, on track" />
            <Field label={LABEL.strengths} value={draft.strengths} onChange={(v) => update("strengths", v)} />
            <Field label={LABEL.struggles} value={draft.struggles} onChange={(v) => update("struggles", v)} />
          </div>
          <Field label={LABEL.nextLessonFocus} value={draft.nextLessonFocus} onChange={(v) => update("nextLessonFocus", v)} />
          <Field
            label={LABEL.parentVisibleComment}
            multiline
            value={draft.parentVisibleComment}
            onChange={(v) => update("parentVisibleComment", v)}
            placeholder="e.g. Great work today on factorisation."
          />
        </div>

        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2.5 rounded-[14px] bg-[#FFF8EC] p-3.5">
          <label htmlFor={`${formId}-internal`} className="text-[13px] font-extrabold text-[#8A4A06]">
            {NOTE_VISIBILITY.internal}
          </label>
          <textarea
            id={`${formId}-internal`}
            rows={5}
            maxLength={5000}
            value={draft.internalNote}
            onChange={(e) => update("internalNote", e.target.value)}
            placeholder="e.g. Struggling with focus - check in with parent privately."
            className={cn(FIELD_CLS, "min-h-[120px] flex-1 resize-y py-2.5 leading-normal")}
          />
        </div>

        <div className="flex flex-[1_1_100%] flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-[12px] text-muted" aria-live="polite">
            {result === "error" ? (
              <span role="alert" className="font-semibold text-bad">
                The note could not be saved. Try again.
              </span>
            ) : result === "saved" && !dirty ? (
              <span className="inline-flex items-center gap-1 font-bold text-good">
                <Check className="h-3.5 w-3.5" aria-hidden />
                Saved
              </span>
            ) : savedEntry.savedAt ? (
              `Last saved ${formatDateTime(new Date(savedEntry.savedAt))}`
            ) : (
              "No note yet"
            )}
          </span>
          <Button
            type="submit"
            variant="outline"
            disabled={pending}
            className="h-10 rounded-[11px] px-3.5"
          >
            Save
          </Button>
          {next && (
            <Button
              type="button"
              disabled={pending}
              onClick={() => save(true)}
              aria-busy={pending || undefined}
              className="h-10 rounded-[11px] px-4"
            >
              {pending && <ActionSpinner />}
              Save &amp; next student
              {!pending && <ArrowRight className="h-4 w-4" aria-hidden />}
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-[5px]">
      <label htmlFor={id} className="text-[12px] font-bold text-ink">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          maxLength={5000}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cn(FIELD_CLS, "resize-y py-2 leading-normal")}
        />
      ) : (
        <input
          id={id}
          value={value}
          maxLength={5000}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cn(FIELD_CLS, "h-[38px]")}
        />
      )}
    </div>
  );
}
