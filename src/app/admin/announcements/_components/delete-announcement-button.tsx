"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/admin/ui";
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
    <Button
      type="button"
      variant="danger"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
        start(async () => {
          await deleteAnnouncement(id);
        });
      }}
      className="shrink-0"
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden />
      Delete
    </Button>
  );
}
