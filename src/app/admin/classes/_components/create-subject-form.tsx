"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSubject } from "@/app/admin/_lib/actions-classes";

export function CreateSubjectForm() {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  if (!open)
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        + Add subject
      </Button>
    );

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const form = e.currentTarget;
        start(async () => {
          await createSubject({
            name: String(fd.get("name") || ""),
            yearLevel: String(fd.get("yearLevel") || "") || undefined,
          });
          form.reset();
          setOpen(false);
        });
      }}
    >
      <Input name="name" placeholder="Subject name (e.g. Maths Methods)" required />
      <Input name="yearLevel" placeholder="Year level (optional)" />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen(false)}
      >
        Cancel
      </Button>
    </form>
  );
}
