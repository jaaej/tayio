"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/admin/ui";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { deleteAnnouncement } from "@/app/admin/_lib/actions-announcements";

export function DeleteAnnouncementButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const [pending, start] = useTransition();
  const { confirm, confirmDialog } = useConfirm();
  return (
    <>
      <Button
        type="button"
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={async () => {
          if (
            !(await confirm({
              title: `Delete "${title}"?`,
              body: "This announcement will be permanently removed. This cannot be undone.",
              confirmLabel: "Delete",
              danger: true,
            }))
          )
            return;
          start(async () => {
            await deleteAnnouncement(id);
          });
        }}
        className="shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        Delete
      </Button>
      {confirmDialog}
    </>
  );
}
