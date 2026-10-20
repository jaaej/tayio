"use client";

import Link from "next/link";
import { Avatar } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import type { CardStudent } from "../_lib/class-card";
import { StudentSearch, type StudentOption } from "./student-search";

/** Quiet text button; Withdraw shows only on hover or focus with a mouse. */
const Q_BTN =
  "flex h-8 shrink-0 items-center rounded-[9px] px-2.5 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 pointer-coarse:h-10";

/**
 * A class's students: "Students · 2 of 8", the Add a student search, and one
 * line per student. Nothing is sent until the page's Save changes; staged
 * joins and leaves say so on their row. New class uses it too, where every
 * student joins when the class is created.
 */
export function ClassStudents({
  students,
  capacity,
  oneOnOne,
  candidates,
  onChange,
  newClass = false,
}: {
  students: CardStudent[];
  capacity: number;
  /** A one-on-one class takes no second student; a group's capacity is a warning. */
  oneOnOne: boolean;
  /** Every student account (those on the class are left out of the search). */
  candidates: (StudentOption & { short: string })[];
  onChange: (students: CardStudent[]) => void;
  /** The class is being created, so a "Joins on save" tag would say nothing. */
  newClass?: boolean;
}) {
  const onClass = new Set(students.map((s) => s.id));
  const available = candidates.filter((c) => !onClass.has(c.id));
  const staying = students.filter((s) => !s.leaving).length;

  const patch = (id: string, change: Partial<CardStudent>) =>
    onChange(students.map((s) => (s.id === id ? { ...s, ...change } : s)));

  function add(id: string) {
    const c = available.find((x) => x.id === id);
    if (c) onChange([...students, { id: c.id, name: c.name, detail: c.short, saved: false, leaving: false }]);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className="text-[12px] font-bold text-[#5E5A73]">
          {/* New class titles its section "Students" already. */}
          {newClass ? `${staying} of ${capacity}` : `Students · ${staying} of ${capacity}`}
        </span>
        {oneOnOne && staying >= 1 ? (
          <span className="text-[13px] font-semibold text-[#5E5A73]">Withdraw to change student</span>
        ) : available.length > 0 ? (
          <StudentSearch options={available} onPick={add} />
        ) : (
          <span className="text-[13px] font-semibold text-[#5E5A73]">Every student is in this class</span>
        )}
      </div>

      <ul className="m-0 list-none overflow-hidden rounded-[14px] border border-[#EFF0F5] p-0">
        {students.length === 0 && (
          <li className="px-3 py-3 text-center text-[13px] text-[#5E5A73]">No students yet.</li>
        )}
        {students.map((s) => (
          <li
            key={s.id}
            className={cn(
              "group flex items-center gap-3 border-b border-[#EFF0F5] py-2 pl-3 pr-2 last:border-b-0",
              s.leaving ? "bg-[#FDF3F2]" : !s.saved ? "bg-[#F3F7FE]" : "hover:bg-[#F8F9FC]",
            )}
          >
            <Avatar name={s.name} size={30} tone="brand" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px]">
                <Link
                  href={`/admin/users/${s.id}`}
                  className={cn(
                    "font-bold text-ink hover:text-brand-600",
                    s.leaving && "line-through decoration-[#B42318]/60",
                  )}
                >
                  {s.name}
                </Link>
                {s.detail && <span className="text-[13px] text-[#5E5A73]"> · {s.detail}</span>}
              </span>
              {s.leaving && (
                <span className="block text-[12px] text-[#5E5A73]">Their past attendance and notes are kept.</span>
              )}
            </span>
            {!newClass && !s.saved && !s.leaving && (
              <span className="shrink-0 text-[12px] font-bold text-[#1E4FB8]">Joins on save</span>
            )}
            {s.leaving && <span className="shrink-0 text-[12px] font-bold text-[#B42318]">Leaves on save</span>}
            {s.leaving ? (
              <button
                type="button"
                onClick={() => patch(s.id, { leaving: false })}
                className={cn(Q_BTN, "text-ink hover:bg-white")}
              >
                Undo
              </button>
            ) : s.saved ? (
              <button
                type="button"
                onClick={() => patch(s.id, { leaving: true })}
                aria-label={`Withdraw ${s.name}`}
                className={cn(
                  Q_BTN,
                  "text-[#5E5A73] opacity-0 hover:bg-[#FDE8E8] hover:text-[#B42318] focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100",
                )}
              >
                Withdraw
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onChange(students.filter((x) => x.id !== s.id))}
                aria-label={`Don't add ${s.name}`}
                className={cn(Q_BTN, "text-[#5E5A73] hover:bg-white hover:text-ink")}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
