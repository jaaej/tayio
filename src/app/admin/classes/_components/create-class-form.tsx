"use client";

import { useMemo, useState, type ReactNode } from "react";
import { defaultClassTimes } from "../_lib/class-time";
import { rankTutorsForSlot, type TutorClassSlot, type TutorWeeklyWindow } from "../_lib/tutor-fit";
import {
  CapacityStepper,
  ClassTypeSegment,
  FIELD,
  Field,
  SelectField,
  WhenFields,
  type ClassTypeValue,
} from "./class-fields";
import { subjectOptionLabel } from "@/lib/subject-label";
import { DEFAULT_GROUP_CAPACITY, classCapacity } from "@/lib/class-capacity";
import { TutorPicker } from "./tutor-picker";
import { RoomPicker } from "./room-picker";
import type { RoomUse } from "../_lib/rooms";

export type CreateClassValues = {
  name: string;
  subjectId: string;
  tutorId: string;
  classType: ClassTypeValue;
  capacity: number;
  location: string | null;
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
  tutorWindows,
  classSlots,
  subjects,
  rooms,
  roomSlots,
  lessonMinutes,
  disabled,
  error,
  onSubmit,
}: {
  formId: string;
  tutors: { id: string; firstName: string; lastName: string }[];
  /** Tutors' weekly availability, to rank them for the chosen day and time. */
  tutorWindows: TutorWeeklyWindow[];
  /** Existing classes, to spot a tutor already teaching at that time. */
  classSlots: TutorClassSlot[];
  subjects: { id: string; name: string; yearLevel: string | null }[];
  /** Room chips: rooms in use, then "Online". */
  rooms: string[];
  /** Every weekly class's slot and room, so a taken room is crossed out. */
  roomSlots: RoomUse[];
  /** Usual lesson length, used to default the end time after the start. */
  lessonMinutes: number;
  disabled: boolean;
  error: string | null;
  onSubmit: (values: CreateClassValues) => void;
}) {
  // Field ids are namespaced by the form so a second panel on the same page
  // can never steal a label's `for` target.
  const fid = (name: string) => `${formId}-${name}`;

  const [classType, setClassType] = useState<ClassTypeValue>("group");
  const [times] = useState(() => defaultClassTimes(lessonMinutes));
  const [subjectId, setSubjectId] = useState("");
  const [room, setRoom] = useState("");
  const [when, setWhen] = useState<{ weekday: number | null; startTime: string; endTime: string }>({
    weekday: null,
    startTime: times.startTime,
    endTime: times.endTime,
  });
  const rankedTutors = useMemo(
    () =>
      rankTutorsForSlot(tutors, tutorWindows, classSlots, {
        ...when,
        subjectId: subjectId || null,
      }),
    [tutors, tutorWindows, classSlots, when, subjectId],
  );

  return (
    <form
      id={formId}
      // Rendered in a SidePanel with `sections`: each Section is its own white
      // panel sitting on the glass sheet.
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const text = (key: string) => String(fd.get(key) ?? "").trim();
        onSubmit({
          name: text("name"),
          subjectId: text("subjectId"),
          tutorId: text("tutorId"),
          classType: fd.get("classType") === "one_on_one" ? "one_on_one" : "group",
          capacity: classCapacity(classType, Number(fd.get("capacity") || DEFAULT_GROUP_CAPACITY)),
          location: text("location") || null,
          isRecurring: fd.get("isRecurring") === "on",
          weekday: text("weekday") === "" ? null : Number(text("weekday")),
          startTime: text("startTime") || null,
          endTime: text("endTime") || null,
        });
      }}
    >
      <fieldset disabled={disabled} className="contents">
        <Section id={fid("s-details")} title="Details">
          <Field id={fid("name")} label="Class name">
            <input
              id={fid("name")}
              name="name"
              required
              placeholder="e.g. Year 10 Maths · Tue PM"
              autoComplete="off"
              className={FIELD}
            />
          </Field>

          <Field id={fid("subjectId")} label="Subject">
            <SelectField
              id={fid("subjectId")}
              name="subjectId"
              required
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="" disabled>
                Choose subject
              </option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {subjectOptionLabel(s)}
                </option>
              ))}
            </SelectField>
          </Field>

          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
            <ClassTypeSegment value={classType} onChange={setClassType} />
            {classType === "one_on_one" ? (
              <Field id={fid("capacity")} label="Capacity">
                <span
                  id={fid("capacity")}
                  className="flex h-11 items-center rounded-[12px] bg-surface-2 px-3.5 text-[14px] font-bold text-ink-soft"
                >
                  1 student
                </span>
              </Field>
            ) : (
              <CapacityStepper id={fid("capacity")} defaultValue={DEFAULT_GROUP_CAPACITY} />
            )}
          </div>
        </Section>

        <Section id={fid("s-when")} title="When">
          <WhenFields
            idPrefix={fid("when")}
            defaultRecurring
            defaultWeekday={null}
            defaultStart={times.startTime}
            defaultEnd={times.endTime}
            lessonMinutes={lessonMinutes}
            onChange={setWhen}
          />
        </Section>

        <Section id={fid("s-where")} title="Where">
          <Field id={fid("location")} label="Room" optional>
            <RoomPicker
              id={fid("location")}
              name="location"
              value={room}
              onChange={setRoom}
              rooms={rooms}
              slot={when}
              others={roomSlots}
              inputClassName={FIELD}
            />
          </Field>
        </Section>

        <Section id={fid("s-tutor")} title="Tutor">
          <TutorPicker name="tutorId" tutors={rankedTutors} />
        </Section>
      </fieldset>

      {error && (
        <p
          role="alert"
          className="rounded-[12px] bg-bad-bg px-3.5 py-2.5 text-[13px] font-semibold text-bad"
        >
          {error}
        </p>
      )}
    </form>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="panel flex flex-col gap-3.5 p-[18px]">
      <h3 id={id} className="text-[13px] font-extrabold text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}
