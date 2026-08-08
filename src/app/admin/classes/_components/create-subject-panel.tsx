"use client";

import { useId, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button, SidePanel } from "@/components/admin/ui";
import { Input, Label } from "@/components/ui/input";
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
      {/* Outline against the header's brand "Create New Class": both open a
          panel, but only one is the page's primary action. */}
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Plus className="h-4 w-4" aria-hidden />
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
            <div className="space-y-1.5">
              <Label htmlFor={nameId} className="block font-bold">
                Subject name
              </Label>
              <Input
                id={nameId}
                name="name"
                required
                placeholder="e.g. Maths Methods"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={yearId} className="block font-bold">
                Year level
              </Label>
              <Input
                id={yearId}
                name="yearLevel"
                placeholder="Optional"
                autoComplete="off"
              />
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="text-[12px] font-semibold text-bad">
              {error}
            </p>
          )}
        </form>
      </SidePanel>
    </>
  );
}
