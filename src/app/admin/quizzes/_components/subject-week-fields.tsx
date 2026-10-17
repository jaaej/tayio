"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { QuizTargetWeek } from "@/lib/quiz-queries";

/**
 * Subject then week, as two dependent dropdowns. `weeks` only ever contains
 * weeks that do not already have a quiz, so picking a subject narrows the
 * second list to the weeks still open for that subject - the admin never sees
 * an option that will be rejected on submit.
 *
 * The week select posts `subjectWeekId`, which is the only value the server
 * actions need; subject is a filter, not a field.
 */
export function SubjectWeekFields({
  idPrefix,
  weeks,
}: {
  idPrefix: string;
  weeks: QuizTargetWeek[];
}) {
  const fixedWeek = weeks.length === 1 ? weeks[0] : null;
  // Keyed by id: two subjects can share a name (labels add the year level).
  const subjects = useMemo(
    () =>
      Array.from(
        new Map(weeks.map((w) => [w.subjectId, w.subjectLabel])).entries(),
        ([id, label]) => ({ id, label }),
      ).sort((a, b) => a.label.localeCompare(b.label)),
    [weeks],
  );

  // Curriculum opens this panel for one exact week. Preselecting the sole
  // option makes that context obvious and avoids asking admin to pick the week
  // they just opened; the standalone multi-week form still starts unselected.
  const onlyWeek = weeks.length === 1 ? weeks[0] : null;
  const [subject, setSubject] = useState(onlyWeek?.subjectId ?? "");
  const [weekId, setWeekId] = useState(onlyWeek?.id ?? "");
  const subjectWeeks = weeks.filter((w) => w.subjectId === subject);

  const subjectId = `${idPrefix}-subject`;
  const weekFieldId = `${idPrefix}-week`;

  if (fixedWeek) {
    return (
      <div className="space-y-1.5">
        <Label className="block font-bold">Curriculum week</Label>
        <input type="hidden" name="subjectWeekId" value={fixedWeek.id} />
        <div className="rounded-[10px] border border-brand-200 bg-brand-50 px-4 py-3 text-[13px] font-semibold text-brand-700">
          {fixedWeek.label}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={subjectId} className="block font-bold">
          Subject
        </Label>
        <Select
          id={subjectId}
          name="subjectId"
          required
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            // The old week belongs to the old subject - clearing it stops a
            // stale id being posted with a freshly changed subject.
            setWeekId("");
          }}
        >
          <option value="" disabled>
            Pick a subject
          </option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={weekFieldId} className="block font-bold">
          Week
        </Label>
        {/* Disabled until a subject is chosen. Subject is `required` and comes
            first in the form, so the browser stops an empty submit there
            rather than letting a skipped week through. */}
        <Select
          id={weekFieldId}
          name="subjectWeekId"
          required
          disabled={subject === ""}
          value={weekId}
          onChange={(e) => setWeekId(e.target.value)}
          className="disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="" disabled>
            {subject === "" ? "Pick a subject first" : "Pick a week"}
          </option>
          {subjectWeeks.map((w) => (
            <option key={w.id} value={w.id}>
              {w.weekLabel}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
