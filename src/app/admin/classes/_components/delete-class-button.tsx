"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/admin/ui";
import { deleteClass, getClassDeletionImpact } from "@/app/admin/_lib/actions-classes";
import { classDeletionItems } from "@/app/admin/_lib/deletion-copy";
import { useConfirm } from "@/components/ui/confirm-dialog";

/**
 * Deletes a class after a confirmation that lists what goes with it. A class
 * that has already run also needs its name typed.
 */
export function DeleteClassButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"checking" | "deleting" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  async function onDelete() {
    setError(null);
    setBusy("checking");
    let impact;
    try {
      ({ impact } = await getClassDeletionImpact(id));
    } catch {
      setBusy(null);
      setError("Could not check this class. Try again.");
      return;
    }
    setBusy(null);

    const ok = await confirm({
      title: `Delete ${name}?`,
      body: impact.hasHistory
        ? "This class has already run. Deleting it permanently removes:"
        : "This can't be undone.",
      items: classDeletionItems(impact),
      confirmText: impact.hasHistory ? name : undefined,
      confirmLabel: "Delete class",
      danger: true,
    });
    if (!ok) return;

    setBusy("deleting");
    try {
      const result = await deleteClass({
        id,
        confirmName: impact.hasHistory ? name : undefined,
      });
      if (!result.ok) {
        setBusy(null);
        setError(result.error);
        return;
      }
      router.push("/admin/classes");
    } catch {
      setBusy(null);
      setError("Could not delete the class. Try again.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        size="lg"
        variant="danger"
        disabled={busy !== null}
        onClick={onDelete}
        className="w-full"
      >
        <Trash2 className="h-4 w-4" strokeWidth={2.2} aria-hidden />
        {busy === "checking" ? "Checking…" : busy === "deleting" ? "Deleting…" : "Delete class"}
      </Button>
      {error && (
        <p role="alert" className="rounded-[12px] bg-bad-bg px-3.5 py-2.5 text-[13px] font-semibold text-bad">
          {error}
        </p>
      )}
      {confirmDialog}
    </div>
  );
}
