"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteClass, getClassDeletionImpact } from "@/app/admin/_lib/actions-classes";
import { classBlockedBody, classDeletionItems } from "@/app/admin/_lib/deletion-copy";
import { richText } from "@/app/admin/_components/rich-text";
import { useConfirm } from "@/components/ui/confirm-dialog";

/**
 * Delete a class, always after a confirmation. A class with lessons that hold
 * attendance, notes or marks is not deleted: the dialog sends the admin to
 * those lessons in Attendance instead. The small Delete on a class card of
 * the subject page.
 */
export function DeleteClassButton({
  id,
  onDeleted,
}: {
  id: string;
  /** After a delete (the card leaves the page). */
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"checking" | "deleting" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  async function onDelete() {
    setError(null);
    setBusy("checking");
    let result;
    try {
      result = await getClassDeletionImpact(id);
    } catch {
      result = { ok: false as const, error: "Could not check this class. Try again." };
    }
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const { impact, subject } = result;

    if (impact.recordedLessons > 0) {
      const review = await confirm({
        icon: "lock",
        title: "This class has history",
        subject,
        body: richText(classBlockedBody(impact.recordedLessons)),
        cancelLabel: "Close",
        confirmLabel: `Review ${impact.recordedLessons} ${impact.recordedLessons === 1 ? "lesson" : "lessons"}`,
      });
      if (review) router.push(`/admin/attendance?class=${id}&view=marked`);
      return;
    }

    const ok = await confirm({
      icon: "delete",
      title: "Delete this class?",
      subject,
      items: classDeletionItems(impact).map(richText),
      warning: "This can’t be undone.",
      confirmLabel: "Delete class",
      danger: true,
    });
    if (!ok) return;

    setBusy("deleting");
    try {
      const deleted = await deleteClass(id);
      if (!deleted.ok) {
        setBusy(null);
        setError(deleted.error);
        return;
      }
      setBusy(null);
      onDeleted();
    } catch {
      setBusy(null);
      setError("Could not delete the class. Try again.");
    }
  }

  const label = busy === "checking" ? "Checking…" : busy === "deleting" ? "Deleting…" : "Delete class";

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={onDelete}
        disabled={busy !== null}
        className="flex h-8 items-center gap-1.5 rounded-[9px] px-2.5 text-[13px] font-bold text-[#5E5A73] transition-colors hover:bg-[#FDE8E8] hover:text-[#B42318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60 pointer-coarse:h-10"
      >
        <Trash2 className="h-[15px] w-[15px]" strokeWidth={1.9} aria-hidden />
        {label}
      </button>
      {error && (
        <p role="alert" className="rounded-[12px] bg-bad-bg px-3.5 py-2.5 text-[13px] font-semibold text-bad">
          {error}
        </p>
      )}
      {confirmDialog}
    </div>
  );
}
