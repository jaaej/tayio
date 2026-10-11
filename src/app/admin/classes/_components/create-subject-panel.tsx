"use client";

import { useId, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button, SidePanel } from "@/components/admin/ui";
import { FIELD, Field } from "./class-fields";
import { createSubject } from "@/app/admin/_lib/actions-classes";

export function CreateSubjectPanel() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formId = useId();
  const nameId = `${formId}-name`;
  const yearId = `${formId}-yearLevel`;

  return (
    <>
      {/* Glass against the header's dark "New class": both open a panel,
          but only one is the page's primary action. */}
      <Button
        type="button"
        variant="glass"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
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
            <Button
              type="submit"
              form={formId}
              size="lg"
              variant="primary"
              disabled={pending}
            >
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
            const fd = new FormData(e.currentTarget);
            setError(null);
            start(async () => {
              try {
                await createSubject({
                  name: String(fd.get("name") ?? "").trim(),
                  yearLevel: String(fd.get("yearLevel") ?? "").trim() || undefined,
                });
                setOpen(false);
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Could not add subject.",
                );
              }
            });
          }}
        >
          <fieldset disabled={pending} className="space-y-5">
            <Field id={nameId} label="Subject name">
              <input
                id={nameId}
                name="name"
                required
                placeholder="e.g. Maths Methods"
                autoComplete="off"
                className={FIELD}
              />
            </Field>
            <Field id={yearId} label="Year level" optional>
              <input
                id={yearId}
                name="yearLevel"
                placeholder="e.g. Year 10"
                autoComplete="off"
                className={FIELD}
              />
            </Field>
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
