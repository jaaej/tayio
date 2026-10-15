"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { RankedTutor } from "../_lib/tutor-fit";

/**
 * The New class tutor choice, under the day and times: every tutor, the ones
 * free for the whole class first, the rest with a note saying why not
 * (`rankTutorsForSlot`). Choosing someone who is not free is still allowed;
 * the note stays on their row.
 */
export function TutorPicker({ name, tutors }: { name: string; tutors: RankedTutor[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const ranked = tutors.some((t) => t.fit !== "unknown");
  const firstOther = tutors.findIndex((t) => t.fit !== "free" && t.fit !== "unknown");
  const anyFree = tutors.some((t) => t.fit === "free");

  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="sr-only">Tutor</legend>
      {!ranked && (
        <p className="pb-1.5 text-[13px] text-ink-soft">
          Pick a day and times above to see who&apos;s free then.
        </p>
      )}
      {ranked && !anyFree && (
        <p className="pb-1.5 text-[13px] font-semibold text-warn">No tutor is free for this whole time.</p>
      )}
      {tutors.map((tutor, i) => {
        const on = selected === tutor.id;
        return (
          <div key={tutor.id} className="contents">
            {ranked && i === 0 && anyFree && <GroupLabel>Free then</GroupLabel>}
            {ranked && i === firstOther && <GroupLabel>Not free then</GroupLabel>}
            <label
              className={cn(
                "flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[12px] border px-3 py-2 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400",
                on ? "border-ink bg-[#F7F6FE]" : "border-line-strong bg-surface hover:bg-surface-2",
              )}
            >
              <input
                type="radio"
                name={name}
                value={tutor.id}
                required
                checked={on}
                onChange={() => setSelected(tutor.id)}
                className="h-[18px] w-[18px] shrink-0 accent-ink"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-bold text-ink">{tutor.name}</span>
                {tutor.note && (
                  <span
                    className={cn(
                      "text-[12px] font-semibold",
                      tutor.fit === "busy" ? "text-warn" : "text-muted",
                    )}
                  >
                    {tutor.note}
                  </span>
                )}
              </span>
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}

function GroupLabel({ children }: { children: string }) {
  return <span className="px-1 pb-0.5 pt-2 text-[12px] font-extrabold text-muted first:pt-0">{children}</span>;
}
