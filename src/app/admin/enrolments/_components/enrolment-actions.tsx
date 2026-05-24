"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  enrollStudent,
  removeEnrollment,
  withdrawStudent,
} from "@/app/admin/_lib/actions-enrollments";

type AddProps = {
  classId: string;
  mode: "add";
  addOptions: { id: string; label: string }[];
};

type RowProps = {
  classId: string;
  studentId: string;
  studentName: string;
  withdrawn: boolean;
  mode?: undefined;
};

export function EnrolmentActions(props: AddProps | RowProps) {
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState(
    props.mode === "add" ? props.addOptions[0]?.id ?? "" : "",
  );

  if (props.mode === "add") {
    if (props.addOptions.length === 0) {
      return (
        <div className="text-sm text-muted">
          All active students are already enrolled.
        </div>
      );
    }
    return (
      <form
        className="flex items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!picked) return;
          start(async () => {
            await enrollStudent({ classId: props.classId, studentId: picked });
          });
        }}
      >
        <div className="flex-1">
          <Select value={picked} onChange={(e) => setPicked(e.target.value)}>
            {props.addOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={pending || !picked}>
          Enrol
        </Button>
      </form>
    );
  }

  return (
    <div className="inline-flex items-center gap-3 justify-end">
      {props.withdrawn ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            start(async () => {
              await enrollStudent({
                classId: props.classId,
                studentId: props.studentId,
              });
            });
          }}
          className="text-xs uppercase tracking-[0.14em] text-brand-700 hover:text-brand-600 disabled:opacity-50"
        >
          Re-enrol
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Withdraw ${props.studentName} from this class?`)) return;
            start(async () => {
              await withdrawStudent({
                classId: props.classId,
                studentId: props.studentId,
              });
            });
          }}
          className="text-xs uppercase tracking-[0.14em] text-amber-700 hover:text-amber-900 disabled:opacity-50"
        >
          Withdraw
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (
            !confirm(
              `Permanently remove ${props.studentName} from this class? Their enrolment record will be deleted.`,
            )
          )
            return;
          start(async () => {
            await removeEnrollment({
              classId: props.classId,
              studentId: props.studentId,
            });
          });
        }}
        className="text-xs uppercase tracking-[0.14em] text-rose-700 hover:text-rose-900 disabled:opacity-50"
      >
        Remove
      </button>
    </div>
  );
}
