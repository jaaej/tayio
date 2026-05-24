"use client";

import { useTransition } from "react";
import { deleteAnnouncement } from "@/app/admin/_lib/actions-announcements";

export function DeleteAnnouncementButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
        start(async () => {
          await deleteAnnouncement(id);
        });
      }}
      className="text-xs uppercase tracking-[0.14em] text-rose-700 hover:text-rose-900 disabled:opacity-50 shrink-0"
    >
      Delete
    </button>
  );
}
