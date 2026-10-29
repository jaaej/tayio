"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Button, Empty } from "@/components/admin/ui";
import { ActionSpinner } from "@/components/ui/loading-button";
import { saveLessonNote } from "@/app/tutor/_actions";
import { formatDateTime } from "@/lib/format";
import { LESSON_NOTE_FIELDS, LESSON_NOTE_SHARED_FIELDS, NOTE_VISIBILITY } from "@/lib/lesson-note-fields";
import { cn } from "@/lib/utils";

export const NOTE_FIELDS = ["parentVisibleComment", "internalNote"] as const;

export type NoteField = (typeof NOTE_FIELDS)[number];
export type NoteValues = Record<NoteField, string>;

export type NoteStudent = {
  id: string;
  name: string;
  isMakeup: boolean;
  /** Marked absent (or moved out of this lesson). */
  absent: boolean;
  /** The saved note, or null when none has been written yet. */
  note: NoteValues | null;
  savedAt: string | null;
};

const EMPTY: NoteValues = { parentVisibleComment: "", internalNote: "" };

const COMMENT_LABEL = LESSON_NOTE_SHARED_FIELDS[0].label;
const INTERNAL_LABEL = LESSON_NOTE_FIELDS.find((f) => f.key === "internalNote")!.label;

const FIELD_CLS =
  "w-full rounded-[10px] border border-line-strong bg-surface px-2.5 text-[14px] text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10";

/**
 * Lesson notes: pick a student from the tabs, then write an optional comment
 * for the family and an optional internal note. Drafts are kept per student,
 * so switching tabs never loses typing; "Save & next student" saves and moves
 * to the next tab. Saving both boxes empty removes the note.
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
    const blank = NOTE_FIELDS.every((f) => !values[f].trim());
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
        [savedFor]: blank ? { note: null, savedAt: null } : { note: values, savedAt: new Date().toISOString() },
      }));
      // Spaces alone removed the note; clear them so the boxes match it.
      if (blank) setDrafts((prev) => ({ ...prev, [savedFor]: EMPTY }));
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
          Lesson notes
        </h2>
        <div role="tablist" aria-label="Student" className="flex flex-wrap gap-1">
          {students.map((s) => {
            const on = s.id === student.id;
            const written = Boolean(saved[s.id]?.note);
            const state = [s.absent && "absent", written ? "note written" : "no note"]
              .filter(Boolean)
              .join(", ");
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
                {written && <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-[#16A34A]" />}
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
          <div className="flex flex-1 flex-col gap-[5px]">
            <label htmlFor={`${formId}-comment`} className="text-[12px] font-bold text-ink">
              {COMMENT_LABEL} <span className="font-semibold text-muted">Optional</span>
            </label>
            <textarea
              id={`${formId}-comment`}
              rows={5}
              maxLength={5000}
              value={draft.parentVisibleComment}
              onChange={(e) => update("parentVisibleComment", e.target.value)}
              placeholder="e.g. Great work today on factorisation."
              className={cn(FIELD_CLS, "min-h-[120px] flex-1 resize-y py-2.5 leading-normal")}
            />
          </div>
        </div>

        <div
          role="group"
          aria-labelledby={`${formId}-private`}
          className="flex min-w-0 flex-[1_1_260px] flex-col gap-3 rounded-[14px] bg-[#FFF8EC] p-3.5"
        >
          <span id={`${formId}-private`} className="text-[13px] font-extrabold text-[#8A4A06]">
            {NOTE_VISIBILITY.internal}
          </span>
          <div className="flex flex-1 flex-col gap-[5px]">
            <label htmlFor={`${formId}-internal`} className="text-[12px] font-bold text-ink">
              {INTERNAL_LABEL} <span className="font-semibold text-muted">Optional</span>
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
