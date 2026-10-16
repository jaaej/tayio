"use client";

import { useId, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button, SidePanel } from "@/components/admin/ui";
import { createSubject } from "@/app/admin/_lib/actions-subjects";
import { defaultSubjectColor, type SubjectColor } from "@/lib/subject-tone";
import { FIELD, Field } from "./class-fields";
import { ColourSwatches, LevelSelect } from "./subject-fields";

/**
 * Add subject: name, level and colour in a side panel. Editing a subject and
 * its classes happens on /admin/subjects/[id]/edit.
 */
export function SubjectPanel() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  // Null until picked: the colour follows the name until then.
  const [picked, setPicked] = useState<SubjectColor | null>(null);
  const formId = useId();
  const colourLabelId = useId();
  const color = picked ?? defaultSubjectColor(name);

  function openPanel() {
    setName("");
    setLevel("");
    setPicked(null);
    setError(null);
    setOpen(true);
  }

  return (
    <>
      {/* Glass against the header's dark "New class": both open a panel,
          but only one is the page's primary action. */}
      <Button type="button" variant="glass" onClick={openPanel}>
        <Plus className="h-[14px] w-[14px]" strokeWidth={2.4} aria-hidden />
        Add subject
      </Button>

      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title="New subject"
        footer={
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
            <Button type="submit" form={formId} size="lg" variant="primary" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              try {
                const result = await createSubject({
                  name: name.trim(),
                  yearLevel: level || undefined,
                  color,
                });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setOpen(false);
              } catch {
                setError("Could not add the subject.");
              }
            });
          }}
        >
          <fieldset disabled={pending} className="space-y-5">
            <Field id={`${formId}-name`} label="Subject name">
              <input
                id={`${formId}-name`}
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Maths Methods"
                autoComplete="off"
                aria-invalid={error ? true : undefined}
                className={FIELD}
              />
            </Field>
            <Field id={`${formId}-level`} label="Level" optional>
              <LevelSelect id={`${formId}-level`} value={level} onChange={setLevel} />
            </Field>
            <div className="flex flex-col gap-2">
              <span id={colourLabelId} className="text-[13px] font-bold text-ink">
                Colour
              </span>
              <ColourSwatches value={color} onChange={setPicked} labelledBy={colourLabelId} />
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="rounded-[12px] bg-bad-bg px-3.5 py-2.5 text-[13px] font-semibold text-bad">
              {error}
            </p>
          )}
        </form>
      </SidePanel>
    </>
  );
}
