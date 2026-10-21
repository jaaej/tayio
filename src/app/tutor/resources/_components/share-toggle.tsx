"use client";

import { useState, useTransition } from "react";
import { setResourcePublished } from "@/app/_actions/resources";
import { Button } from "@/components/student/button";

/**
 * Share / unshare a resource with the students taking the subject. Backed by
 * the existing `setResourcePublished` action - unsharing only hides the
 * resource from the student and parent libraries, it never deletes anything,
 * so there is no confirmation step.
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
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    start(async () => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("published", isShared ? "false" : "true");
      try {
        const res = await setResourcePublished(formData);
        if (!res.ok) setError(res.error);
      } catch {
        setError("Could not update sharing. Try again.");
      }
    });
  }

  return (
    <div className="min-w-0 flex-1">
      <Button
        type="button"
        size="lg"
        // Sharing is the action a tutor still owes their students, so it gets
        // the filled treatment; unsharing an already-shared resource is the
        // routine case and stays quiet, or every card shouts at once.
        variant={isShared ? "default" : "primary"}
        onClick={toggle}
        disabled={pending}
        className="w-full"
      >
        {pending ? "Saving…" : isShared ? "Unshare" : "Share with students"}
        {/* Appended rather than set as an aria-label, so the accessible name
            still starts with the visible words a voice-control user says. */}
        <span className="sr-only">{title}</span>
      </Button>
      {error && (
        <p role="alert" className="mt-1.5 text-[12px] font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
