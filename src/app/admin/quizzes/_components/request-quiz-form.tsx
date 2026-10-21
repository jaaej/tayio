"use client";

import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { QuizTargetWeek } from "@/lib/quiz-queries";
import { SubjectWeekFields } from "./subject-week-fields";

export type RequestQuizValues = {
  subjectWeekId: string;
  title: string;
  tutorId: string;
  note?: string;
};

/**
 * Body of the "Ask a tutor" tab of the new-quiz slide-over. Same field
 * structure as `NewQuizForm` plus the tutor it goes to and an optional brief.
 */
export function RequestQuizForm({
  formId,
  tutors,
  weeks,
  disabled,
  error,
  onSubmit,
}: {
  formId: string;
  tutors: { id: string; name: string }[];
  weeks: QuizTargetWeek[];
  disabled: boolean;
  error: string | null;
  onSubmit: (values: RequestQuizValues) => void;
}) {
  const titleId = `${formId}-title`;
  const tutorId = `${formId}-tutor`;
  const noteId = `${formId}-note`;

  return (
    <form
      id={formId}
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const note = String(fd.get("note") ?? "").trim();
        onSubmit({
          subjectWeekId: String(fd.get("subjectWeekId") ?? ""),
          title: String(fd.get("title") ?? "").trim(),
          tutorId: String(fd.get("tutorId") ?? ""),
          note: note.length > 0 ? note : undefined,
        });
      }}
    >
      <fieldset disabled={disabled} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor={titleId} className="block font-bold">
            Title
          </Label>
          <Input
            id={titleId}
            name="title"
            required
            maxLength={200}
            placeholder="Week 4 quiz"
            autoComplete="off"
          />
        </div>

        <SubjectWeekFields idPrefix={formId} weeks={weeks} />

        <div className="space-y-1.5">
          <Label htmlFor={tutorId} className="block font-bold">
            Tutor
          </Label>
          <Select id={tutorId} name="tutorId" required defaultValue="">
            <option value="" disabled>
              Pick a tutor
            </option>
            {tutors.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={noteId} className="block font-bold">
            Note (optional)
          </Label>
          <textarea
            id={noteId}
            name="note"
            rows={3}
            maxLength={5000}
            placeholder="Anything the tutor should know before building this quiz"
            className="w-full rounded-[10px] border border-line-field bg-card px-4 py-2.5 text-sm text-ink placeholder:text-muted/70 transition-colors focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
          />
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-[12px] font-semibold text-bad">
          {error}
        </p>
      )}
    </form>
  );
}
