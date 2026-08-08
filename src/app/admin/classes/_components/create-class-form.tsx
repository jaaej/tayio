"use client";

import { useId, useState, type ReactNode } from "react";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CLASS_TYPE_OPTIONS = [
  { value: "group", label: "Group" },
  { value: "one_on_one", label: "One-on-one" },
] as const;

export type CreateClassValues = {
  name: string;
  subjectId: string;
  tutorId: string;
  classType: "group" | "one_on_one";
  capacity: number;
  location: string | null;
  onlineLink: string | null;
  isRecurring: boolean;
  weekday: number | null;
  startTime: string | null;
  endTime: string | null;
};

/**
 * Body of the create-class slide-over. The submit button lives in the panel's
 * footer and reaches back in via `form={formId}`, so the panel owns the pending
 * / error state and this component stays a plain set of fields.
 */
export function CreateClassForm({
  formId,
  tutors,
  subjects,
  disabled,
  error,
  onSubmit,
}: {
  formId: string;
  tutors: { id: string; firstName: string; lastName: string }[];
  subjects: { id: string; name: string; yearLevel: string | null }[];
  disabled: boolean;
  error: string | null;
  onSubmit: (values: CreateClassValues) => void;
}) {
  // Field ids are namespaced by the form so a second panel on the same page
  // can never steal a label's `for` target.
  const fid = (name: string) => `${formId}-${name}`;

  const [classType, setClassType] =
    useState<CreateClassValues["classType"]>("group");

  return (
    <form
      id={formId}
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const text = (key: string) => String(fd.get(key) ?? "").trim();
        onSubmit({
          name: text("name"),
          subjectId: text("subjectId"),
          tutorId: text("tutorId"),
          classType: fd.get("classType") === "one_on_one" ? "one_on_one" : "group",
          capacity: Number(fd.get("capacity") || 8),
          location: text("location") || null,
          onlineLink: text("onlineLink") || null,
          isRecurring: fd.get("isRecurring") === "on",
          weekday: text("weekday") === "" ? null : Number(fd.get("weekday")),
          startTime: text("startTime") || null,
          endTime: text("endTime") || null,
        });
      }}
    >
      <fieldset disabled={disabled} className="space-y-5">
        <Field id={fid("name")} label="Class name">
          <Input
            id={fid("name")}
            name="name"
            required
            placeholder="Year 10 Maths · Tue PM"
            autoComplete="off"
          />
        </Field>

        <Field id={fid("subjectId")} label="Subject">
          <Select id={fid("subjectId")} name="subjectId" required defaultValue="">
            <option value="" disabled>
              Pick a subject
            </option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.yearLevel ? ` (Yr ${s.yearLevel})` : ""}
              </option>
            ))}
          </Select>
        </Field>

        <Field id={fid("tutorId")} label="Tutor">
          <Select id={fid("tutorId")} name="tutorId" required defaultValue="">
            <option value="" disabled>
              Pick a tutor
            </option>
            {tutors.map((t) => (
              <option key={t.id} value={t.id}>
                {t.firstName} {t.lastName}
              </option>
            ))}
          </Select>
        </Field>

        {/* Single column until `sm` so the two type pills never wrap into a
            second line beside the capacity field on a phone-width panel. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ClassTypeRadioGroup value={classType} onChange={setClassType} />
          <Field id={fid("capacity")} label="Capacity">
            <Input
              id={fid("capacity")}
              name="capacity"
              type="number"
              min={1}
              max={200}
              defaultValue={8}
              required
            />
          </Field>
        </div>

        {/* The recurring toggle governs the three fields under it, so it sits
            with them rather than at the foot of the form. */}
        <div className="space-y-3 border-t border-line pt-5">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              name="isRecurring"
              defaultChecked
              className="h-4 w-4 accent-brand-600"
            />
            Recurring weekly
          </label>
          <Field id={fid("weekday")} label="Weekday">
            <Select id={fid("weekday")} name="weekday" defaultValue="">
              <option value="">-</option>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id={fid("startTime")} label="Start time">
              <Input id={fid("startTime")} name="startTime" type="time" />
            </Field>
            <Field id={fid("endTime")} label="End time">
              <Input id={fid("endTime")} name="endTime" type="time" />
            </Field>
          </div>
        </div>

        <div className="space-y-5 border-t border-line pt-5">
          <Field id={fid("location")} label="Location">
            <Input
              id={fid("location")}
              name="location"
              placeholder="Room 3 · Hawthorn"
              autoComplete="off"
            />
          </Field>
          <Field id={fid("onlineLink")} label="Online link">
            <Input
              id={fid("onlineLink")}
              name="onlineLink"
              type="url"
              placeholder="https://…"
              autoComplete="off"
            />
          </Field>
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

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="block font-bold">
        {label}
      </Label>
      {children}
    </div>
  );
}

/**
 * Class type as a pill group - a two-option dropdown hid the choice behind a
 * click. Real `<input type="radio">`s sit behind the pills, so arrow-key
 * navigation, form semantics and screen-reader announcement come from the
 * browser. Same shape and styling as the role picker in
 * `admin/users/_components/create-user-form.tsx`.
 */
function ClassTypeRadioGroup({
  value,
  onChange,
}: {
  value: CreateClassValues["classType"];
  onChange: (classType: CreateClassValues["classType"]) => void;
}) {
  const labelId = useId();

  return (
    <div>
      {/* Block, like the `Field` label, so its line box is sized by its own
          11px text and the pills line up with the capacity input beside it. */}
      <span
        id={labelId}
        className="block text-[11px] font-bold uppercase tracking-[0.14em] text-muted"
      >
        Class type
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="mt-1.5 flex flex-wrap gap-2"
      >
        {CLASS_TYPE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-[12px] font-bold transition-colors",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 has-[:focus-visible]:ring-offset-1",
              value === option.value
                ? "border-brand-500 bg-brand-500 text-white"
                : "border-line-strong bg-surface text-ink hover:border-brand-500 hover:text-brand-700",
            )}
          >
            <input
              type="radio"
              name="classType"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}
