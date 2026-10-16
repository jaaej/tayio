"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/admin/ui";
import { deleteClass, getClassDeletionImpact } from "@/app/admin/_lib/actions-classes";
import { classBlockedBody, classDeletionItems } from "@/app/admin/_lib/deletion-copy";
import { richText } from "@/app/admin/_components/rich-text";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

/**
 * Delete a class, always after a confirmation. A class with lessons that hold
 * attendance, notes or marks is not deleted: the dialog sends the admin to
 * those lessons in Attendance instead.
 *
 * `inline` is the small Delete on a class card (edit page); `block` is the
 * full-width button on the class page.
 */
export function DeleteClassButton({
  id,
  variant,
  onDeleted,
}: {
  id: string;
  variant: "inline" | "block";
  /** After a delete; the class page goes back to Classes by default. */
  onDeleted?: () => void;
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
      if (onDeleted) {
        setBusy(null);
        onDeleted();
      } else {
        router.push("/admin/classes");
      }
    } catch {
      setBusy(null);
      setError("Could not delete the class. Try again.");
    }
  }

  const label = busy === "checking" ? "Checking…" : busy === "deleting" ? "Deleting…" : "Delete";

  return (
    <div className={cn("flex flex-col gap-2", variant === "inline" && "items-end")}>
      {variant === "inline" ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={busy !== null}
          className="flex h-[34px] items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-bold text-ink-soft transition-colors hover:bg-[#FDE8E8] hover:text-[#B42318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60"
        >
          <Trash2 className="h-[15px] w-[15px]" strokeWidth={1.9} aria-hidden />
          {label}
        </button>
      ) : (
        <Button
          type="button"
          size="lg"
          variant="danger"
          disabled={busy !== null}
          onClick={onDelete}
          className="w-full"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.2} aria-hidden />
          {busy ? label : "Delete class"}
        </Button>
      )}
      {error && (
        <p role="alert" className="rounded-[12px] bg-bad-bg px-3.5 py-2.5 text-[13px] font-semibold text-bad">
          {error}
        </p>
      )}
      {confirmDialog}
    </div>
  );
}
