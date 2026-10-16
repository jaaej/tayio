"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/admin/ui";
import {
  createSubjectWeek,
  deleteSubjectWeek,
  updateSubjectWeek,
} from "@/app/admin/_lib/actions-curriculum";
import type { SubjectWeek } from "@/db/schema";

/**
 * The curriculum week's learner-facing fields: number, topic, title,
 * overview and objectives. Creates a week inline on the new-week page, and
 * edits one inside the hero's Edit week panel (`onSaved` closes it).
 */
export function WeekForm({
  existing,
  subjectId,
  termId,
  topics,
  onSaved,
}: {
  existing?: SubjectWeek;
  subjectId: string;
  termId: string;
  topics: { id: string; name: string }[];
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    formData.set("subjectId", subjectId);
    formData.set("termId", termId);
    setError(null);
    startTransition(async () => {
      if (existing) {
        const result = await updateSubjectWeek(existing.id, formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onSaved?.();
        router.refresh();
        return;
      }

      const result = await createSubjectWeek(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.href = `/admin/subjects/${subjectId}/curriculum?term=${termId}&week=${result.id}`;
    });
  }

  function removeWeek() {
    if (!existing) return;
    if (!confirm("Delete this week and all related progress and overrides?")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteSubjectWeek(existing.id, subjectId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.href = `/admin/subjects/${subjectId}/curriculum?term=${termId}`;
    });
  }

  return (
    <form action={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
        <Field label="Week number">
          <input
            name="weekNumber"
            type="number"
            defaultValue={existing?.weekNumber ?? 1}
            className={INPUT}
            min={1}
            max={20}
            required
          />
        </Field>
        <Field label="Topic">
          <select
            name="topicId"
            defaultValue={existing?.topicId ?? ""}
            className={INPUT}
          >
            <option value="">Unassigned</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Week title">
        <input
          name="title"
          defaultValue={existing?.title ?? ""}
          placeholder="What students are learning this week"
          className={INPUT}
          required
        />
      </Field>
      <Field label="Overview">
        <textarea
          name="description"
          defaultValue={existing?.description ?? ""}
          rows={5}
          placeholder="Give students a short, plain-language overview of the week."
          className={INPUT}
        />
      </Field>
      <Field
        label="Learning objectives"
        hint="One objective per line. These become the learner checklist."
      >
        <textarea
          name="objectives"
          defaultValue={existing?.objectives ?? ""}
          rows={6}
          placeholder={
            "Use alternate and co-interior angle rules\nSolve multi-step angle problems"
          }
          className={INPUT}
        />
      </Field>
      {error && (
        <p
          role="alert"
          className="rounded-[10px] bg-bad-bg px-3 py-2 text-[13px] font-semibold text-bad"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : existing ? "Save changes" : "Create week"}
        </Button>
        {existing && (
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={removeWeek}
          >
            Delete week
          </Button>
        )}
      </div>
    </form>
  );
}

const INPUT =
  "min-h-11 w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink placeholder:text-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-bold text-ink-soft">{label}</span>
      {children}
      {hint && (
        <span className="block text-[11px] leading-relaxed text-muted">{hint}</span>
      )}
    </label>
  );
}
