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
  // `subjects.name` is unique in the schema, so the name is a safe key.
  const subjects = useMemo(
    () =>
      Array.from(new Set(weeks.map((w) => w.subjectName))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [weeks],
  );

  const [subject, setSubject] = useState("");
  const [weekId, setWeekId] = useState("");
  const subjectWeeks = weeks.filter((w) => w.subjectName === subject);

  const subjectId = `${idPrefix}-subject`;
  const weekFieldId = `${idPrefix}-week`;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={subjectId} className="block font-bold">
          Subject
        </Label>
        <Select
          id={subjectId}
          name="subjectName"
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
          {subjects.map((name) => (
            <option key={name} value={name}>
              {name}
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
