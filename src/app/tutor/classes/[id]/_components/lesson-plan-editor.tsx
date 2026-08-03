"use client";

import { useState, useTransition } from "react";
import { updateLessonPlan } from "../../../_actions";

export function LessonPlanEditor({
  classId,
  initial,
}: {
  classId: string;
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    "idle",
  );
  const [pending, start] = useTransition();

  function handleBlur() {
    if (value === saved) return;
    setStatus("saving");
    start(async () => {
      try {
        const res = await updateLessonPlan({ classId, plan: value });
        if (res.ok) {
          setSaved(value);
          setStatus("done");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-[0.12em] font-bold text-muted">
          Visible to students and parents
        </span>
        {status === "saving" && (
          <span className="text-[11px] font-semibold text-muted">Saving…</span>
        )}
        {status === "done" && (
          <span className="text-[11px] font-semibold text-good">Saved</span>
        )}
        {status === "error" && (
          <span className="text-[11px] font-semibold text-bad">Save failed</span>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (status !== "idle") setStatus("idle");
        }}
        onBlur={handleBlur}
        disabled={pending}
        maxLength={4000}
        rows={4}
        placeholder="What's coming up in this class - topics, focus, what to prepare…"
        className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25 resize-y min-h-[92px]"
      />
    </div>
  );
}
