"use client";

import { useState, type ComponentProps } from "react";
import { Pencil } from "lucide-react";
import { Button, SidePanel } from "@/components/admin/ui";
import { HomeworkSolutionEditor } from "@/components/homework/homework-solution-editor";
import { EditHomeworkForm } from "./edit-homework-form";

/**
 * "Edit homework": the homework's details and its solution upload, for every
 * student it is set for, in a side panel so marking stays the page's one job.
 */
export function HomeworkSettings({
  form,
  hasSolution,
  solutionHref,
}: {
  form: ComponentProps<typeof EditHomeworkForm>;
  hasSolution: boolean;
  solutionHref: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="glass"
        className="h-[38px] rounded-[11px] px-3"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-4 w-4" aria-hidden />
        Edit homework
      </Button>
      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title="Edit homework"
        sub={form.title}
      >
        <div className="flex flex-col gap-5">
          <EditHomeworkForm {...form} />
          <HomeworkSolutionEditor
            homeworkId={form.homeworkId}
            hasSolution={hasSolution}
            solutionHref={solutionHref}
          />
        </div>
      </SidePanel>
    </>
  );
}
