"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/admin/ui";
import { updateClass } from "@/app/admin/_lib/actions-classes";
import type { ClassType } from "@/db/schema";
import { FALLBACK_LESSON_MINUTES } from "../../_lib/class-time";
import { subjectOptionLabel } from "../../_lib/subject-option-label";
import {
  CapacityStepper,
  ClassTypeSegment,
  FIELD,
  Field,
  SelectField,
  WhenFields,
} from "../../_components/class-fields";

type Initial = {
  name: string;
  subjectId: string;
  tutorId: string;
  classType: ClassType;
  capacity: number;
  location: string;
  onlineLink: string;
  isRecurring: boolean;
  weekday: number | null;
  startTime: string;
  endTime: string;
};

/** postgres TIME comes back as HH:MM:SS; <input type="time"> wants HH:MM. */
const toInputTime = (t: string) => t.slice(0, 5);

export function EditClassForm({
  id,
  initial,
  tutors,
  subjects,
}: {
  id: string;
  initial: Initial;
  tutors: { id: string; firstName: string; lastName: string }[];
  subjects: { id: string; name: string; yearLevel: string | null }[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [classType, setClassType] = useState<ClassType>(initial.classType);
  const fid = useId();
  const f = (name: string) => `${fid}-${name}`;

  return (
    <form
      className="flex flex-col gap-3.5 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setOk(false);
        const fd = new FormData(e.currentTarget);
        const text = (key: string) => String(fd.get(key) ?? "").trim();
        start(async () => {
          try {
            const res = await updateClass({
              id,
              name: text("name"),
              subjectId: text("subjectId"),
              tutorId: text("tutorId"),
              classType: fd.get("classType") === "one_on_one" ? "one_on_one" : "group",
              capacity: Number(fd.get("capacity") || 8),
              location: text("location") || null,
              onlineLink: text("onlineLink") || null,
              isRecurring: fd.get("isRecurring") === "on",
              // No day chosen sends nothing: null, never Sunday (0).
              weekday: text("weekday") === "" ? null : Number(text("weekday")),
              startTime: text("startTime") || null,
              endTime: text("endTime") || null,
            });
            if (res.ok) setOk(true);
            else setError(res.error);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save the class.");
          }
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        <Field id={f("name")} label="Class name">
          <input
            id={f("name")}
            name="name"
            defaultValue={initial.name}
            required
            autoComplete="off"
            className={FIELD}
          />
        </Field>
        <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2">
          <Field id={f("subjectId")} label="Subject">
            <SelectField
              id={f("subjectId")}
              name="subjectId"
              defaultValue={initial.subjectId}
              required
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {subjectOptionLabel(s)}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field id={f("tutorId")} label="Tutor">
            <SelectField
              id={f("tutorId")}
              name="tutorId"
              defaultValue={initial.tutorId}
              required
            >
              {tutors.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.firstName} {t.lastName}
                </option>
              ))}
            </SelectField>
          </Field>
        </div>
        <div className="grid grid-cols-1 items-end gap-2.5 min-[420px]:grid-cols-[minmax(0,1fr)_132px]">
          <ClassTypeSegment value={classType} onChange={setClassType} />
          <CapacityStepper id={f("capacity")} defaultValue={initial.capacity} />
        </div>

        <div aria-hidden className="my-0.5 h-px bg-line" />

        <WhenFields
          idPrefix={f("when")}
          defaultRecurring={initial.isRecurring}
          defaultWeekday={initial.weekday}
          defaultStart={toInputTime(initial.startTime)}
          defaultEnd={toInputTime(initial.endTime)}
          lessonMinutes={FALLBACK_LESSON_MINUTES}
        />

        <div aria-hidden className="my-0.5 h-px bg-line" />

        <Field id={f("location")} label="Location" optional>
          <input
            id={f("location")}
            name="location"
            defaultValue={initial.location}
            autoComplete="off"
            className={FIELD}
          />
        </Field>
        <Field id={f("onlineLink")} label="Online link" optional>
          <input
            id={f("onlineLink")}
            name="onlineLink"
            type="url"
            placeholder="https://"
            defaultValue={initial.onlineLink}
            autoComplete="off"
            className={FIELD}
          />
        </Field>
      </fieldset>

      {error && (
        <p
          role="alert"
          className="rounded-[12px] bg-bad-bg px-3.5 py-2.5 text-[13px] font-semibold text-bad"
        >
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" variant="primary" disabled={pending} className="w-full">
          {pending ? "Saving…" : "Save changes"}
        </Button>
        {ok && (
          <p role="status" className="text-center text-[13px] font-semibold text-good">
            Saved.
          </p>
        )}
      </div>
    </form>
  );
}
