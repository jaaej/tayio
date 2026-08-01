"use client";

import { useState, useTransition } from "react";
import { Pill, Button } from "@/components/admin/ui";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/input";
import {
  enrollStudent,
  setAdminNotes,
  setDeliveryMode,
  withdrawStudent,
} from "@/app/admin/_lib/actions-enrollments";

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

export function EnrollmentsManager({
  classId,
  enrolled,
  availableStudents,
  capacity,
}: {
  classId: string;
  enrolled: Student[];
  availableStudents: Student[];
  capacity: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [modeOverride, setModeOverride] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

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

  function handleRemove(studentId: string) {
    if (
      !confirm("Withdraw this student from the class? Past records are kept.")
    )
      return;
    setError(null);
    startTransition(async () => {
      await withdrawStudent({ classId, studentId });
    });
  }

  const atCapacity = enrolled.length >= capacity;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13px] font-bold text-ink-soft tabular-nums">
          {enrolled.length} of {capacity} enrolled
        </div>
        {atCapacity && <Pill tone="warn">At capacity</Pill>}
      </div>

      {enrolled.length === 0 ? (
        <div className="text-[13px] text-muted italic">
          No students enrolled yet.
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-[14px] border border-line overflow-hidden">
          {enrolled.map((s) => (
            <li
              key={s.id}
              className="px-5 py-3.5 hover:bg-surface-2 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-bold text-ink truncate">
                    {s.firstName} {s.lastName}
                  </div>
                  <div className="text-xs text-muted truncate">
                    {s.school ? `${s.school} · ${s.email}` : s.email}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <select
                    aria-label={`Delivery mode for ${s.firstName} ${s.lastName}`}
                    value={modeOverride[s.id] ?? s.deliveryMode ?? ""}
                    onChange={(e) => handleDelivery(s.id, e.target.value)}
                    disabled={pending}
                    className="rounded-lg border border-line bg-surface px-2 py-1 text-[12px] text-ink disabled:opacity-50"
                  >
                    <option value="">Default</option>
                    <option value="in_person">In person</option>
                    <option value="online">Online</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRemove(s.id)}
                    disabled={pending}
                    className="text-[11px] uppercase tracking-[0.16em] font-bold text-bad hover:brightness-90 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <AdminNotesField
                classId={classId}
                studentId={s.id}
                initial={s.adminNotes ?? ""}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-line pt-4 space-y-2">
        <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-muted">
          Add a student
        </div>
        <div className="flex gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13px] text-ink"
            disabled={pending}
          >
            <option value="">- Select a student -</option>
            {availableStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName} · {s.email}
              </option>
            ))}
          </select>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={!selected || pending}
          >
            {pending ? "Adding…" : "Add"}
          </Button>
        </div>
        {availableStudents.length === 0 && (
          <div className="text-xs text-muted">
            All students are already enrolled in this class.
          </div>
        )}
      </div>

      {error && <div className="text-[13px] font-semibold text-bad">{error}</div>}
    </div>
  );
}

function AdminNotesField({
  classId,
  studentId,
  initial,
}: {
  classId: string;
  studentId: string;
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

  const fieldId = `admin-notes-${studentId}`;

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={fieldId}>Admin notes</Label>
        {status === "saving" && (
          <span className="text-[11px] font-semibold text-muted">Saving…</span>
        )}
        {status === "done" && (
          <span className="text-[11px] font-semibold text-good">Saved</span>
        )}
        {status === "error" && (
          <span className="text-[11px] font-semibold text-bad">
            Save failed
          </span>
        )}
      </div>
      <Textarea
        id={fieldId}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (status !== "idle") setStatus("idle");
        }}
        onBlur={handleBlur}
        disabled={pending}
        maxLength={2000}
        placeholder="Internal notes for this enrolment (not visible to student or parent)"
        className="min-h-[64px] text-[13px]"
      />
    </div>
  );
}
