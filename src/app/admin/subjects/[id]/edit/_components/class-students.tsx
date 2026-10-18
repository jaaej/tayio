"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Undo2, UserMinus, X } from "lucide-react";
import { Avatar } from "@/components/admin/ui";
import { SelectField } from "@/app/admin/classes/_components/class-fields";
import { cn } from "@/lib/utils";
import type { CardStudent } from "../_lib/class-card";

const SMALL_SELECT = "h-9 rounded-[10px] border-[#DCDEE9] pl-2.5 text-[13px] font-semibold";
const ROW_BUTTON =
  "flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

/**
 * A class card's students: who is enrolled and the picker to add someone.
 * Nothing here is sent until the page's Save changes; staged joins and leaves
 * say so on their row.
 */
export function ClassStudents({
  students,
  capacity,
  candidates,
  onChange,
}: {
  students: CardStudent[];
  capacity: number;
  /** Every student account, to add from (those on the card are left out). */
  candidates: { id: string; name: string; detail: string }[];
  onChange: (students: CardStudent[]) => void;
}) {
  const pickerId = useId();
  const [picked, setPicked] = useState("");
  const onCard = new Set(students.map((s) => s.id));
  const available = candidates.filter((c) => !onCard.has(c.id));
  const staying = students.filter((s) => !s.leaving).length;
  const full = staying >= capacity;

  const patch = (id: string, change: Partial<CardStudent>) =>
    onChange(students.map((s) => (s.id === id ? { ...s, ...change } : s)));

  function add() {
    const student = available.find((c) => c.id === picked);
    if (!student) return;
    onChange([...students, { ...student, saved: false, leaving: false }]);
    setPicked("");
  }

  return (
    <div className="flex flex-col gap-2.5 border-t border-[#EFF0F5] pt-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className="flex items-baseline gap-2">
          <span className="text-[14px] font-extrabold text-ink">Students</span>
          <span className="text-[12px] font-semibold tabular-nums text-[#5E5A73]">
            {staying} of {capacity}
          </span>
          {full && (
            <span className="rounded-full bg-warn-bg px-2 py-0.5 text-[11px] font-extrabold text-warn">
              At capacity
            </span>
          )}
        </span>
        {available.length > 0 ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <label htmlFor={pickerId} className="sr-only">
              Student to add
            </label>
            <span className="w-[min(260px,60vw)]">
              <SelectField
                id={pickerId}
                value={picked}
                onChange={(e) => setPicked(e.target.value)}
                className={SMALL_SELECT}
              >
                <option value="">Add a student…</option>
                {available.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.detail}
                  </option>
                ))}
              </SelectField>
            </span>
            <button
              type="button"
              onClick={add}
              disabled={!picked}
              className={cn(ROW_BUTTON, "bg-ink px-3.5 text-white hover:bg-[#2b2847] disabled:opacity-40")}
            >
              Add
            </button>
          </span>
        ) : (
          <span className="text-[13px] font-semibold text-[#5E5A73]">Every student is in this class</span>
        )}
      </div>

      {students.length === 0 ? (
        <p className="rounded-[12px] bg-[#F7F8FB] px-3 py-3 text-center text-[13px] text-[#5E5A73]">
          No students yet.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {students.map((s) => (
            <li
              key={s.id}
              className={cn(
                "flex flex-col gap-2 rounded-[12px] border px-3 py-2.5",
                s.leaving
                  ? "border-[#F4C7C3] bg-[#FDF3F2]"
                  : !s.saved
                    ? "border-[#C9D8F8] bg-[#F3F7FE]"
                    : "border-[#EFF0F5] bg-white",
              )}
            >
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={s.name} size={32} tone="brand" />
                <span className="flex min-w-[150px] flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-x-2">
                    <Link
                      href={`/admin/users/${s.id}`}
                      className={cn(
                        "truncate text-[14px] font-bold text-ink hover:text-brand-600",
                        s.leaving && "line-through decoration-[#B42318]/60",
                      )}
                    >
                      {s.name}
                    </Link>
                    {!s.saved && !s.leaving && (
                      <span className="text-[12px] font-bold text-[#1E4FB8]">Joins on save</span>
                    )}
                    {s.leaving && (
                      <span className="text-[12px] font-bold text-[#B42318]">Leaves on save</span>
                    )}
                  </span>
                  <span className="truncate text-[12px] text-[#5E5A73]">{s.detail}</span>
                </span>
                {s.leaving ? (
                  <button
                    type="button"
                    onClick={() => patch(s.id, { leaving: false })}
                    className={cn(ROW_BUTTON, "text-ink hover:bg-white")}
                  >
                    <Undo2 className="h-[15px] w-[15px]" aria-hidden />
                    Undo
                  </button>
                ) : s.saved ? (
                  <button
                    type="button"
                    onClick={() => patch(s.id, { leaving: true })}
                    aria-label={`Withdraw ${s.name}`}
                    className={cn(ROW_BUTTON, "border border-[#DCDEE9] bg-white text-ink hover:bg-[#F6F7FA]")}
                  >
                    <UserMinus className="h-[15px] w-[15px]" aria-hidden />
                    Withdraw
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onChange(students.filter((x) => x.id !== s.id))}
                    aria-label={`Don't add ${s.name}`}
                    className={cn(ROW_BUTTON, "text-ink-soft hover:bg-white hover:text-ink")}
                  >
                    <X className="h-[15px] w-[15px]" aria-hidden />
                    Remove
                  </button>
                )}
              </div>
              {s.leaving && (
                <p className="text-[12px] text-[#5E5A73]">
                  Their past attendance and notes are kept.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
