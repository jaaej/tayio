"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/admin/ui";
import { deleteClassAnnouncement } from "@/app/tutor/_actions";
import { resubmitClassAnnouncement } from "../_lib/actions";
import { CHECK, FIELD } from "./announcement-compose";

type Announcement = {
  id: string;
  title: string;
  body: string;
  isUrgent: boolean;
  includeLinkedParents: boolean;
  rejectedReason: string | null;
};

/** Admin feedback with "Edit & resubmit", for an announcement sent back. */
export function ChangesRequested({
  classId,
  announcement: a,
}: {
  classId: string;
  announcement: Announcement;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    formData.set("announcementId", a.id);
    formData.set("classId", classId);
    setError(null);
    startTransition(async () => {
      const res = await resubmitClassAnnouncement(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] bg-warn-bg px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2.5">
        <p className="min-w-0 flex-1 text-[12px] font-semibold text-warn">
          Admin: {a.rejectedReason || "Changes requested."}
        </p>
        {!editing && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
          >
            Edit &amp; resubmit
          </Button>
        )}
      </div>
      {editing && (
        <form action={submit} className="flex flex-col gap-2.5 rounded-[10px] bg-surface p-3">
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
            Title
            <input
              name="title"
              required
              maxLength={200}
              defaultValue={a.title}
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
              defaultValue={a.body}
              className={`${FIELD} resize-y py-2.5 leading-relaxed`}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-semibold text-ink">
            <input
              type="checkbox"
              name="includeLinkedParents"
              defaultChecked={a.includeLinkedParents}
              className={CHECK}
            />
            Also send to parents
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-semibold text-ink">
            <input
              type="checkbox"
              name="isUrgent"
              defaultChecked={a.isUrgent}
              className={CHECK}
            />
            Urgent - also email everyone
          </label>
          {error && (
            <p role="alert" className="text-[13px] font-semibold text-bad">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setError(null);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Resubmit for approval"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Delete one of the tutor's announcements, after a confirm. */
export function DeleteAnnouncement({
  classId,
  announcementId,
  title,
}: {
  classId: string;
  announcementId: string;
  title: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
    const formData = new FormData();
    formData.set("announcementId", announcementId);
    formData.set("classId", classId);
    setError(null);
    startTransition(async () => {
      try {
        await deleteClassAnnouncement(formData);
        router.refresh();
      } catch {
        setError("Could not delete. Try again.");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={remove}
        aria-label={`Delete ${title}`}
        className="hover:text-bad"
      >
        {pending ? "Deleting…" : "Delete"}
      </Button>
      {error && (
        <span role="alert" className="text-[12px] font-semibold text-bad">
          {error}
        </span>
      )}
    </>
  );
}
