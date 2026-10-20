"use client";

import { useId, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button, SidePanel } from "@/components/admin/ui";
import { createClass } from "@/app/admin/_lib/actions-classes";
import type { TutorClassSlot, TutorWeeklyWindow } from "../_lib/tutor-fit";
import { CreateClassForm, type CreateClassValues } from "./create-class-form";
import type { RoomUse } from "../_lib/rooms";
import type { StudentOption } from "@/app/admin/subjects/[id]/edit/_components/student-search";

export function CreateClassPanel({
  tutors,
  tutorWindows,
  classSlots,
  subjects,
  rooms,
  roomSlots,
  lessonMinutes,
  students,
  triggerSize = "md",
  defaultOpen = false,
}: {
  tutors: { id: string; firstName: string; lastName: string }[];
  /** Tutors' weekly availability, for the tutor picker. */
  tutorWindows: TutorWeeklyWindow[];
  /** Existing classes, so the picker can flag a tutor teaching then. */
  classSlots: TutorClassSlot[];
  subjects: { id: string; name: string; yearLevel: string | null }[];
  /** Room chips: rooms in use, then "Online". */
  rooms: string[];
  /** Every weekly class's slot and room, so a taken room is crossed out. */
  roomSlots: RoomUse[];
  /** Usual lesson length in minutes; the end time defaults this far after the start. */
  lessonMinutes: number;
  /** Active student accounts, for Add a student. */
  students: (StudentOption & { short: string })[];
  /** `lg` for the empty-state trigger, where the button is the whole surface. */
  triggerSize?: "md" | "lg";
  /** Open on arrival, for links such as the dashboard's "New class". */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // The page can mount this panel twice (header + empty state), so the id that
  // wires the footer submit back to the form has to be per-instance.
  const formId = useId();

  // A class needs both a subject and a tutor to point at. Rather than let the
  // form fail on an empty dropdown, the panel says what is missing first.
  const blocker =
    subjects.length === 0
      ? "Add a subject before creating a class."
      : tutors.length === 0
        ? "Create a tutor account before creating a class."
        : null;

  function submit(values: CreateClassValues) {
    setError(null);
    start(async () => {
      try {
        const res = await createClass(values);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        // `createClass` revalidates /admin/classes, so closing is enough - the
        // new class appears in the schedule behind the panel.
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create class.");
      }
    });
  }

  const footer = blocker ? (
    <Button
      type="button"
      size="lg"
      variant="outline"
      onClick={() => setOpen(false)}
    >
      Close
    </Button>
  ) : (
    <>
      <Button
        type="button"
        size="lg"
        variant="outline"
        disabled={pending}
        onClick={() => setOpen(false)}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form={formId}
        size="lg"
        variant="primary"
        disabled={pending}
      >
        {pending ? (
          "Saving…"
        ) : (
          <>
            <Plus className="h-[15px] w-[15px]" strokeWidth={2.4} aria-hidden />
            Create class
          </>
        )}
      </Button>
    </>
  );

  return (
    <>
      <Button
        type="button"
        variant="primary"
        size={triggerSize}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Plus className="h-[15px] w-[15px]" strokeWidth={2.4} aria-hidden />
        New class
      </Button>

      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title="New class"
        footer={footer}
        sections={!blocker}
      >
        {blocker ? (
          <p className="text-[14px] text-ink-soft">{blocker}</p>
        ) : (
          <CreateClassForm
            formId={formId}
            tutors={tutors}
            tutorWindows={tutorWindows}
            classSlots={classSlots}
            subjects={subjects}
            rooms={rooms}
            roomSlots={roomSlots}
            lessonMinutes={lessonMinutes}
            students={students}
            disabled={pending}
            error={error}
            onSubmit={submit}
          />
        )}
      </SidePanel>
    </>
  );
}
