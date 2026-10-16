"use client";

import { useState } from "react";
import { Pencil, Settings2 } from "lucide-react";
import { HERO_ACTION } from "@/components/subjects/subject-hero";
import { SidePanel } from "@/components/ui/side-panel";
import type { SubjectWeek } from "@/db/schema";
import { TopicsPanel } from "./topics-panel";
import { WeekForm } from "./week-form";

/** The hero's white "Edit week" button and the slide-over it opens. */
export function EditWeekButton({
  week,
  subjectId,
  termId,
  topics,
  color,
}: {
  week: SubjectWeek;
  subjectId: string;
  termId: string;
  topics: { id: string; name: string }[];
  /** Text colour: the subject's `fg`, as on the student hero's button. */
  color: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${HERO_ACTION} gap-2`}
        style={{ color }}
      >
        <Pencil className="h-4 w-4" aria-hidden />
        Edit week
      </button>
      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title={`Edit week ${week.weekNumber}`}
        sub="Update the learner-facing title, overview, objectives, and topic."
        size="wide"
      >
        <WeekForm
          existing={week}
          subjectId={subjectId}
          termId={termId}
          topics={topics}
          onSaved={() => setOpen(false)}
        />
      </SidePanel>
    </>
  );
}

/**
 * "Manage topics" under the weeks rail, beside "Add week": topics are the
 * rail's group headings, so they are managed where they show.
 */
export function ManageTopicsButton({
  subjectId,
  topics,
  weekCounts,
}: {
  subjectId: string;
  topics: { id: string; name: string; position: number }[];
  weekCounts: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-line-strong bg-surface text-[13px] font-bold text-ink transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <Settings2 className="h-4 w-4" aria-hidden />
        Manage topics
      </button>
      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title="Manage curriculum topics"
        sub="Topics organise the weeks rail. Rename or reorder them without leaving this week."
        size="wide"
      >
        <TopicsPanel
          subjectId={subjectId}
          topics={topics}
          weekCounts={weekCounts}
          embedded
        />
      </SidePanel>
    </>
  );
}
