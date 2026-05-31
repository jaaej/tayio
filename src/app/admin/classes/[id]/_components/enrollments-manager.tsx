"use client";

import { useState, useTransition } from "react";
import {
  enrollStudent,
  withdrawStudent,
} from "@/app/admin/_lib/actions-enrollments";

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  school?: string | null;
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
  const [pending, startTransition] = useTransition();

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
      <div className="flex items-baseline justify-between">
        <div className="text-sm text-ink-soft">
          {enrolled.length} of {capacity} enrolled
        </div>
        {atCapacity && (
          <div className="text-xs uppercase tracking-wide text-amber-700">
            At capacity
          </div>
        )}
      </div>

      {enrolled.length === 0 ? (
        <div className="text-sm text-ink-soft italic">
          No students enrolled yet.
        </div>
      ) : (
        <ul className="divide-y divide-hairline/60 rounded-lg border border-hairline/60 overflow-hidden">
          {enrolled.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="text-sm text-ink truncate">
                  {s.firstName} {s.lastName}
                </div>
                <div className="text-xs text-muted truncate">
                  {s.school ? `${s.school} · ${s.email}` : s.email}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(s.id)}
                disabled={pending}
                className="text-xs text-rose-700 hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-hairline/60 pt-4 space-y-2">
        <div className="text-xs uppercase tracking-wide text-muted">
          Add a student
        </div>
        <div className="flex gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 rounded-md border border-hairline/60 bg-card px-3 py-2 text-sm"
            disabled={pending}
          >
            <option value="">— Select a student —</option>
            {availableStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName} · {s.email}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!selected || pending}
            className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add"}
          </button>
        </div>
        {availableStudents.length === 0 && (
          <div className="text-xs text-muted">
            All students are already enrolled in this class.
          </div>
        )}
      </div>

      {error && <div className="text-sm text-rose-700">{error}</div>}
    </div>
  );
}
