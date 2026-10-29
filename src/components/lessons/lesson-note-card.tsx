import { NOTE_VISIBILITY, sharedNoteFields } from "@/lib/lesson-note-fields";
import type { RecordNote } from "@/lib/student-record";
import { cn } from "@/lib/utils";

/** Who is reading: a tutor reads "you" on their own note, an admin the tutor's name. */
export type NoteViewer = { kind: "tutor"; id: string } | { kind: "admin" };

/**
 * A lesson note as staff read it: its fields under the same two labels the
 * editor uses, then its author. Shared by the student record's lessons and
 * the admin roll's lesson notes.
 */
export function LessonNoteCard({
  note,
  viewer,
  className,
}: {
  note: RecordNote;
  viewer: NoteViewer;
  className?: string;
}) {
  const shared = sharedNoteFields(note);
  const internal = note.internalNote ?? "";
  const mine = viewer.kind === "tutor" && note.authorId === viewer.id;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap gap-2">
        {shared.length > 0 && (
          <div className="min-w-0 flex-[999_1_300px] rounded-[12px] bg-good-bg/60 p-3 text-[13px] leading-normal text-ink">
            <strong className="mb-1.5 block text-[12px] font-extrabold text-good">
              {NOTE_VISIBILITY.shared}
            </strong>
            <dl className="flex flex-col gap-1.5">
              {shared.map((field) => (
                <div key={field.key}>
                  <dt className="text-[12px] font-bold text-ink-soft">{field.label}</dt>
                  <dd className="whitespace-pre-wrap [overflow-wrap:anywhere]">{field.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {internal && (
          <div className="min-w-0 flex-[1_1_200px] rounded-[12px] bg-warn-bg/60 p-3 text-[13px] leading-normal text-ink">
            <strong className="mb-1.5 block text-[12px] font-extrabold text-warn">
              {viewer.kind === "admin" ? NOTE_VISIBILITY.internalForAdmin : NOTE_VISIBILITY.internal}
            </strong>
            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{internal}</p>
          </div>
        )}
        {shared.length === 0 && !internal && (
          <p className="text-[13px] text-muted">The note is empty.</p>
        )}
      </div>
      <p className="text-[12px] text-muted">Written by {mine ? "you" : note.authorName}</p>
    </div>
  );
}
