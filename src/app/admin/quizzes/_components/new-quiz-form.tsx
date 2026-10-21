"use client";

import { Input, Label } from "@/components/ui/input";
import type { QuizTargetWeek } from "@/lib/quiz-queries";
import { SubjectWeekFields } from "./subject-week-fields";

export type NewQuizValues = { subjectWeekId: string; title: string };

/**
 * Body of the "I'll write it" tab of the new-quiz slide-over. The submit
 * button lives in the panel's footer and reaches back in via `form={formId}`,
 * so the panel owns pending / error state and this stays a set of fields.
 */
export function NewQuizForm({
  formId,
  weeks,
  disabled,
  error,
  onSubmit,
}: {
  formId: string;
  weeks: QuizTargetWeek[];
  disabled: boolean;
  error: string | null;
  onSubmit: (values: NewQuizValues) => void;
}) {
  const titleId = `${formId}-title`;

  return (
    <form
      id={formId}
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSubmit({
          subjectWeekId: String(fd.get("subjectWeekId") ?? ""),
          title: String(fd.get("title") ?? "").trim(),
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
      </fieldset>

      {error && (
        <p role="alert" className="text-[12px] font-semibold text-bad">
          {error}
        </p>
      )}
    </form>
  );
}
