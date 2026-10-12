"use client";

import { useState, useTransition } from "react";
import { setResourcePublished } from "@/app/_actions/resources";
import { cn } from "@/lib/utils";

/**
 * Share / unshare a resource with the students taking the subject, as a
 * switch. Backed by the existing `setResourcePublished` action - unsharing
 * only hides the resource from the student and parent libraries, it never
 * deletes anything, so there is no confirmation step. The switch moves as
 * soon as it is pressed and snaps back if the save fails.
 */
export function ShareToggle({
  id,
  isShared,
  title,
}: {
  id: string;
  isShared: boolean;
  title: string;
}) {
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const on = optimistic ?? isShared;

  function toggle() {
    const next = !on;
    setError(null);
    setOptimistic(next);
    start(async () => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("published", next ? "true" : "false");
      try {
        const res = await setResourcePublished(formData);
        if (!res.ok) setError(res.error);
      } catch {
        setError("Could not update sharing. Try again.");
      }
      // The server value (revalidated on success) takes over again.
      setOptimistic(null);
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`Share ${title} with students`}
        onClick={toggle}
        disabled={pending}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-[10px] pr-2 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-wait",
          on ? "text-ink" : "text-muted",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "relative h-[22px] w-9 shrink-0 rounded-full transition-colors duration-150",
            on ? "bg-ink" : "bg-[#DCDEE9]",
          )}
        >
          <span
            className={cn(
              "absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(23,21,43,0.2)] transition-[left] duration-150 motion-reduce:transition-none",
              on ? "left-[17px]" : "left-[3px]",
            )}
          />
        </span>
        {/* State text for sighted users; assistive tech reads aria-checked. */}
        <span aria-hidden>{on ? "Shared" : "Not shared"}</span>
      </button>
      {error && (
        <p role="alert" className="text-[12px] font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
