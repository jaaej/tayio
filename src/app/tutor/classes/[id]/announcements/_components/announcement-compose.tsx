"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/admin/ui";
import { createClassAnnouncement } from "@/app/tutor/_actions";

export const FIELD =
  "w-full rounded-[11px] border border-line-strong bg-surface px-3 text-[14px] text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10";
export const CHECK = "h-[18px] w-[18px] shrink-0 accent-[var(--ink)]";

/** Compose a class announcement; it goes to admin for approval first. */
export function AnnouncementCompose({
  classId,
  rosterCount,
}: {
  classId: string;
  rosterCount: number;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [parents, setParents] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    formData.set("classId", classId);
    setError(null);
    setSent(false);
    startTransition(async () => {
      try {
        await createClassAnnouncement(formData);
        formRef.current?.reset();
        setParents(true);
        setSent(true);
        router.refresh();
      } catch {
        setError("The announcement could not be sent. Check it and try again.");
      }
    });
  }

  const students = `${rosterCount} ${rosterCount === 1 ? "student" : "students"}`;

  return (
    <form ref={formRef} action={submit} className="flex flex-col gap-3 p-4">
      <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
        Title
        <input
          name="title"
          required
          maxLength={200}
          placeholder="e.g. Practice test next week"
          className={`${FIELD} h-11`}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
        Message
        <textarea
          name="body"
          required
          rows={4}
          maxLength={10000}
          className={`${FIELD} resize-y py-2.5 leading-relaxed`}
        />
      </label>
      <label className="flex min-h-6 cursor-pointer items-center gap-2.5 text-[13px] font-semibold text-ink">
        <input
          type="checkbox"
          name="includeLinkedParents"
          checked={parents}
          onChange={(e) => setParents(e.target.checked)}
          className={CHECK}
        />
        Also send to parents
      </label>
      <label className="flex min-h-6 cursor-pointer items-center gap-2.5 text-[13px] font-semibold text-ink">
        <input type="checkbox" name="isUrgent" className={CHECK} />
        Urgent - also email everyone
      </label>
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-bad">
          {error}
        </p>
      )}
      {sent && !error && (
        <p role="status" className="text-[13px] font-semibold text-good">
          Sent to admin for approval.
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Send to admin for approval"}
      </Button>
      <p className="text-center text-[12px] text-muted">
        Goes to {students}
        {parents ? " and their parents" : ""}
      </p>
    </form>
  );
}
