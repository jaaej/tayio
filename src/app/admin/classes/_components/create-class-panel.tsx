"use client";

import { useId, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button, SidePanel } from "@/components/admin/ui";
import { createClass } from "@/app/admin/_lib/actions-classes";
import { CreateClassForm, type CreateClassValues } from "./create-class-form";

export function CreateClassPanel({
  tutors,
  subjects,
  triggerSize = "md",
}: {
  tutors: { id: string; firstName: string; lastName: string }[];
  subjects: { id: string; name: string; yearLevel: string | null }[];
  /** `lg` for the empty-state trigger, where the button is the whole surface. */
  triggerSize?: "md" | "lg";
}) {
  const [open, setOpen] = useState(false);
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
        await createClass(values);
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
        variant="ghost"
        disabled={pending}
        onClick={() => setOpen(false)}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form={formId}
        size="lg"
        variant="brand"
        disabled={pending}
      >
        {pending ? "Saving…" : "Create class"}
      </Button>
    </>
  );

  return (
    <>
      <Button
        type="button"
        variant="brand"
        size={triggerSize}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Create New Class
      </Button>

      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title="New class"
        footer={footer}
      >
        {blocker ? (
          <p className="text-[13px] text-ink-soft">{blocker}</p>
        ) : (
          <CreateClassForm
            formId={formId}
            tutors={tutors}
            subjects={subjects}
            disabled={pending}
            error={error}
            onSubmit={submit}
          />
        )}
      </SidePanel>
    </>
  );
}
