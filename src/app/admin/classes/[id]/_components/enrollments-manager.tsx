"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Avatar, Button, Empty, GlassPanel, Pill } from "@/components/admin/ui";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  enrollStudent,
  setAdminNotes,
  setDeliveryMode,
  withdrawStudent,
} from "@/app/admin/_lib/actions-enrollments";
import { cn } from "@/lib/utils";

type DeliveryMode = "in_person" | "online";

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  school?: string | null;
  deliveryMode?: DeliveryMode | null;
  adminNotes?: string | null;
};

/** Compact native select for the title row and the enrolment rows. */
const SMALL_SELECT =
  "min-w-0 cursor-pointer rounded-[10px] border border-line-field bg-surface px-2.5 text-[13px] font-semibold text-ink transition-colors focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10 disabled:opacity-50";

export function EnrollmentsManager({
  classId,
  enrolled,
  availableStudents,
  capacity,
  className,
}: {
  classId: string;
  enrolled: Student[];
  availableStudents: Student[];
  capacity: number;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [modeOverride, setModeOverride] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const { confirm, confirmDialog } = useConfirm();

  function handleDelivery(studentId: string, value: string) {
    setModeOverride((prev) => ({ ...prev, [studentId]: value }));
    setError(null);
    const mode = value === "" ? null : (value as DeliveryMode);
    startTransition(async () => {
      await setDeliveryMode({ classId, studentId, mode });
    });
  }

  function handleAdd() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const res = await enrollStudent({ classId, studentId: selected });
      if (!res.ok) setError(res.error);
      else setSelected("");
    });
  }

  async function handleRemove(student: Student) {
    const ok = await confirm({
      title: `Withdraw ${student.firstName} ${student.lastName}?`,
      body: "They leave this class. Past attendance and notes are kept.",
      confirmLabel: "Withdraw",
      danger: true,
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      await withdrawStudent({ classId, studentId: student.id });
    });
  }

  const atCapacity = enrolled.length >= capacity;

  // The confirm dialog renders outside the panel: .glass uses backdrop-filter,
  // which would make it the containing block for the fixed-position overlay.
  return (
    <>
    <GlassPanel
      as="section"
      className={className}
      title="Enrolled students"
      titleId="enrolled-heading"
      meta={`${enrolled.length} of ${capacity}`}
      action={
        <>
          {atCapacity && <Pill tone="warn">At capacity</Pill>}
          {availableStudents.length === 0 ? (
            <span className="px-1.5 text-[13px] font-semibold text-ink-soft">
              Every student is enrolled
            </span>
          ) : (
            <>
              <select
                aria-label="Student to add"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                disabled={pending}
                className={cn(SMALL_SELECT, "h-9 max-w-[240px]")}
              >
                <option value="">Select a student…</option>
                {availableStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} · {s.email}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="md"
                variant="primary"
                onClick={handleAdd}
                disabled={!selected || pending}
              >
                {pending && selected ? "Adding…" : "Add"}
              </Button>
            </>
          )}
        </>
      }
    >
      {error && (
        <p
          role="alert"
          className="border-b border-line bg-bad-bg px-4 py-2.5 text-[13px] font-semibold text-bad"
        >
          {error}
        </p>
      )}
      {enrolled.length === 0 ? (
        <Empty>No students enrolled yet.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {enrolled.map((s) => {
            const name = `${s.firstName} ${s.lastName}`.trim();
            return (
              <li
                key={s.id}
                className="flex flex-col gap-2.5 px-4 py-3.5 transition-colors hover:bg-[#F8F9FC]"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={name} size={36} tone="brand" />
                  <div className="flex min-w-[160px] flex-1 flex-col">
                    <Link
                      href={`/admin/users/${s.id}`}
                      className="truncate text-[14px] font-bold text-ink hover:text-brand-600"
                    >
                      {name}
                    </Link>
                    <span className="truncate text-[12px] text-muted">
                      {s.school ? `${s.school} · ${s.email}` : s.email}
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
                    Delivery
                    <select
                      aria-label={`Delivery mode for ${name}`}
                      value={modeOverride[s.id] ?? s.deliveryMode ?? ""}
                      onChange={(e) => handleDelivery(s.id, e.target.value)}
                      disabled={pending}
                      className={cn(SMALL_SELECT, "h-9")}
                    >
                      <option value="">Default</option>
                      <option value="in_person">In person</option>
                      <option value="online">Online</option>
                    </select>
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleRemove(s)}
                    disabled={pending}
                    className="h-9"
                  >
                    Remove
                  </Button>
                </div>
                <AdminNotesField
                  classId={classId}
                  studentId={s.id}
                  studentName={name}
                  initial={s.adminNotes ?? ""}
                />
              </li>
            );
          })}
        </ul>
      )}
    </GlassPanel>
    {confirmDialog}
    </>
  );
}

function AdminNotesField({
  classId,
  studentId,
  studentName,
  initial,
}: {
  classId: string;
  studentId: string;
  studentName: string;
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    "idle",
  );
  const [pending, startTransition] = useTransition();

  function handleBlur() {
    if (value === saved) return;
    setStatus("saving");
    startTransition(async () => {
      try {
        const res = await setAdminNotes({ classId, studentId, notes: value });
        if (res.ok) {
          setSaved(value);
          setStatus("done");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    });
  }

  const statusId = `admin-notes-status-${studentId}`;

  return (
    <div className="flex flex-col gap-1">
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (status !== "idle") setStatus("idle");
        }}
        onBlur={handleBlur}
        disabled={pending}
        maxLength={2000}
        rows={1}
        aria-label={`Admin note for ${studentName}`}
        aria-describedby={statusId}
        placeholder="Admin note for this enrolment (not visible to student or parent)"
        className="min-h-9 w-full resize-y rounded-[10px] border border-line-field bg-[#FAFBFD] px-3 py-[7px] text-[13px] leading-5 text-ink placeholder:text-muted focus:border-ink focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-ink/10 disabled:opacity-60"
      />
      <span id={statusId} role="status" className="text-[12px] font-semibold">
        {status === "saving" && <span className="text-muted">Saving…</span>}
        {status === "done" && <span className="text-good">Saved</span>}
        {status === "error" && <span className="text-bad">Save failed</span>}
      </span>
    </div>
  );
}
