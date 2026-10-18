"use client";

import { Bell, ChevronDown, ChevronRight, X } from "lucide-react";
import { DeleteClassButton } from "@/app/admin/classes/_components/delete-class-button";
import { SelectField } from "@/app/admin/classes/_components/class-fields";
import { RoomPicker } from "@/app/admin/classes/_components/room-picker";
import type { RoomUse } from "@/app/admin/classes/_lib/rooms";
import {
  rankTutorsForSlot,
  type TutorClassSlot,
  type TutorWeeklyWindow,
} from "@/app/admin/classes/_lib/tutor-fit";
import { classNameDetail } from "@/lib/class-display";
import { formatTimeRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CardDetails, CardSlot, CardStudent } from "../_lib/class-card";
import { ClassStudents } from "./class-students";
import type { StudentOption } from "./student-search";
import { TimeRangeField } from "./time-range-field";

/** A class on the edit page: what was saved, and what is on screen now. */
export type ClassCardState = {
  key: string;
  id?: string;
  /** "22 lessons run" or "starts 24 Oct"; null for a class with neither. */
  history: string | null;
  enrolled: number;
  parents: number;
  /** Null for a class added on this page and not saved yet. */
  saved: CardSlot | null;
  current: CardSlot;
  savedDetails: CardDetails | null;
  details: CardDetails;
  students: CardStudent[];
};

const LBL = "text-[12px] font-bold text-[#5E5A73]";
const FIELD =
  "h-10 w-full min-w-0 rounded-[11px] border border-[#DCDEE9] bg-white px-2.5 text-[14px] text-ink transition-colors focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10 disabled:opacity-60";

/** Monday first, as the schedule reads; values are JS weekdays (Sun = 0). */
const DAYS = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [0, "Sunday"],
] as const;
const DAY_SHORT = new Map<number, string>(DAYS.map(([v, l]) => [v, l.slice(0, 3)]));

const CLASS_TYPES = [
  ["group", "Group"],
  ["one_on_one", "One-on-one"],
] as const;

/** "Mon 5:00 – 6:30 pm", or null without a weekly day and time. */
function whenLabel(slot: CardSlot): string | null {
  if (slot.weekday === null || !slot.startTime || !slot.endTime) return null;
  return `${DAY_SHORT.get(slot.weekday)} ${formatTimeRange(slot.startTime, slot.endTime)}`;
}

function title(card: ClassCardState, subjectName: string) {
  return classNameDetail(subjectName, card.details.name) || card.details.name || "New class";
}

/**
 * A closed class: one line with its name, day and time, tutor, room and
 * places. Clicking it opens the class (and closes the open one).
 */
export function ClosedClass({
  card,
  subjectName,
  tutorName,
  error,
  onOpen,
}: {
  card: ClassCardState;
  subjectName: string;
  tutorName: (id: string) => string | null;
  error?: string;
  onOpen: () => void;
}) {
  const staying = card.students.filter((s) => !s.leaving).length;
  const when = whenLabel(card.current);
  const tutor = card.current.tutorId ? tutorName(card.current.tutorId) : null;
  const room = card.current.room.trim();
  const draft = !card.saved;
  return (
    <button
      type="button"
      id={card.id ? `class-${card.id}` : undefined}
      onClick={onOpen}
      aria-expanded={false}
      className="grid w-full scroll-mt-6 grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-b border-[#EFF0F5] px-[18px] py-3.5 text-left text-[14px] text-ink transition-colors last:border-b-0 hover:bg-[#F8F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 first:rounded-t-[16px] last:rounded-b-[16px] md:grid-cols-[14px_170px_170px_minmax(0,1fr)_110px_110px]"
    >
      <ChevronRight className="h-[14px] w-[14px] text-[#5E5A73]" strokeWidth={2.4} aria-hidden />
      <span className="flex min-w-0 items-center gap-2 font-extrabold">
        <span className="truncate">{title(card, subjectName)}</span>
        {draft && (
          <span className="flex h-5 shrink-0 items-center rounded-[10px] bg-[#FDF1E0] px-[7px] text-[11px] font-extrabold text-[#8A4A06]">
            Not saved
          </span>
        )}
        {error && (
          <span className="flex h-5 shrink-0 items-center rounded-[10px] bg-bad-bg px-[7px] text-[11px] font-extrabold text-bad">
            Needs a fix
          </span>
        )}
      </span>
      <span className={cn("truncate max-md:col-start-2 max-md:row-start-2 max-md:text-[13px]", !when && "text-[#9A9AAD]")}>
        {when ?? "No day yet"}
        <span className="md:hidden">
          {" · "}
          {tutor ?? "No tutor yet"}
          {room ? ` · ${room}` : ""}
        </span>
      </span>
      <span className={cn("hidden truncate md:block", !tutor && "text-[#9A9AAD]")}>{tutor ?? "No tutor yet"}</span>
      <span className={cn("hidden truncate md:block", !room && "text-[#9A9AAD]")}>{room || "No room yet"}</span>
      <span className="text-right tabular-nums text-[#5E5A73] max-md:col-start-3 max-md:row-start-1">
        {staying} of {card.details.capacity || 1}
      </span>
    </button>
  );
}

/**
 * The open class: its name as an editable title, then day, time, tutor and
 * room; type and capacity; students; and what saving will tell people.
 */
export function OpenClass({
  card,
  formId,
  subjectId,
  subjectName,
  tutors,
  tutorWindows,
  classSlots,
  rooms,
  others,
  candidates,
  notice,
  error,
  onClose,
  onSlot,
  onDetails,
  onType,
  onStudents,
  onRemove,
  onDeleted,
}: {
  card: ClassCardState;
  formId: string;
  subjectId: string;
  subjectName: string;
  tutors: { id: string; name: string; firstName: string; lastName: string }[];
  tutorWindows: TutorWeeklyWindow[];
  classSlots: (TutorClassSlot & { classId: string })[];
  rooms: string[];
  others: RoomUse[];
  candidates: (StudentOption & { short: string })[];
  notice: string | null;
  error?: string;
  onClose: () => void;
  onSlot: (patch: Partial<CardSlot>) => void;
  onDetails: (patch: Partial<CardDetails>) => void;
  onType: (classType: CardDetails["classType"]) => void;
  onStudents: (students: CardStudent[]) => void;
  /** Drop a class added on this page. */
  onRemove: () => void;
  /** After a saved class is deleted. */
  onDeleted: () => void;
}) {
  const id = (part: string) => `${formId}-${card.key}-${part}`;
  const ranked = rankTutorsForSlot(
    tutors,
    tutorWindows,
    classSlots.filter((s) => s.classId !== card.id),
    {
      weekday: card.current.weekday,
      startTime: card.current.startTime || null,
      endTime: card.current.endTime || null,
      subjectId,
    },
  );
  const free = ranked.filter((t) => t.fit === "free" || t.fit === "unknown");
  const notFree = ranked.filter((t) => t.fit !== "free" && t.fit !== "unknown");
  const tutorNote = ranked.find((t) => t.id === card.current.tutorId)?.note;
  const roomChanged = card.saved && card.saved.room.trim() !== card.current.room.trim();
  const oneOnOne = card.details.classType === "one_on_one";

  return (
    <div
      id={card.id ? `class-${card.id}` : undefined}
      className="scroll-mt-6 border-b border-[#EFF0F5] last:border-b-0"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-3 pl-[18px] pr-4 pt-3.5">
        <button
          type="button"
          onClick={onClose}
          aria-expanded
          aria-label={`Close ${title(card, subjectName)}`}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-ink transition-colors hover:bg-[#F1F2F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <ChevronDown className="h-[14px] w-[14px]" strokeWidth={2.4} aria-hidden />
        </button>
        <input
          id={id("name")}
          aria-label="Class name"
          value={card.details.name}
          onChange={(e) => onDetails({ name: e.target.value })}
          placeholder="Named from its day and time"
          maxLength={200}
          autoComplete="off"
          className="h-[34px] min-w-[150px] max-w-full rounded-[9px] [field-sizing:content] border border-transparent bg-transparent px-2 text-[16px] font-extrabold text-ink transition-colors placeholder:font-semibold placeholder:text-[#9A9AAD] hover:border-[#DCDEE9] focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10"
        />
        {card.history && <span className="text-[13px] font-semibold text-[#5E5A73]">{card.history}</span>}
        {!card.saved && (
          <span className="flex h-5 items-center rounded-[10px] bg-[#FDF1E0] px-[7px] text-[11px] font-extrabold text-[#8A4A06]">
            Not saved
          </span>
        )}
        <span className="ml-auto">
          {card.id ? (
            <DeleteClassButton id={card.id} onDeleted={onDeleted} />
          ) : (
            <button
              type="button"
              onClick={onRemove}
              className="flex h-8 items-center gap-1.5 rounded-[9px] px-2.5 text-[13px] font-bold text-[#5E5A73] transition-colors hover:bg-[#F1F2F7] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <X className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden />
              Remove
            </button>
          )}
        </span>
      </div>

      <div className="flex flex-col gap-[18px] pb-[18px] pl-[18px] pr-[18px] sm:pl-11">
        <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 lg:[grid-template-columns:150px_220px_minmax(0,1fr)_170px]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id("day")} className={LBL}>
              Day
            </label>
            <SelectField
              id={id("day")}
              value={card.current.weekday === null ? "" : String(card.current.weekday)}
              onChange={(e) => onSlot({ weekday: e.target.value === "" ? null : Number(e.target.value) })}
              className="h-10 rounded-[11px] border-[#DCDEE9] px-2.5 text-[14px]"
            >
              <option value="">No weekly day</option>
              {DAYS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="flex flex-col gap-1.5">
            <span id={id("time")} className={LBL}>
              Time
            </span>
            <TimeRangeField
              labelledBy={id("time")}
              start={card.current.startTime}
              end={card.current.endTime}
              onChange={onSlot}
              className="h-10 rounded-[11px] border border-[#DCDEE9] bg-white px-3"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id("tutor")} className={LBL}>
              Tutor
            </label>
            <SelectField
              id={id("tutor")}
              value={card.current.tutorId}
              onChange={(e) => onSlot({ tutorId: e.target.value })}
              aria-describedby={tutorNote ? id("tutor-note") : undefined}
              className={cn(
                "h-10 rounded-[11px] border-[#DCDEE9] px-2.5 text-[14px]",
                tutorNote && "border-[#E8B66A]",
              )}
            >
              {!card.current.tutorId && (
                <option value="" disabled>
                  Choose tutor
                </option>
              )}
              {notFree.length === 0 ? (
                free.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))
              ) : (
                <>
                  {free.length > 0 && (
                    <optgroup label="Free then">
                      {free.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Not free then">
                    {notFree.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                </>
              )}
            </SelectField>
            {tutorNote && (
              <p id={id("tutor-note")} className="text-[12px] font-semibold text-[#8A4A06]">
                {tutorNote}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id("room")} className={LBL}>
              Room
            </label>
            <RoomPicker
              id={id("room")}
              value={card.current.room}
              onChange={(room) => onSlot({ room })}
              rooms={rooms}
              slot={card.current}
              others={others}
              fieldClassName={cn(FIELD, roomChanged && "border-ink")}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3.5">
          <div className="flex flex-col gap-1.5">
            <span id={id("type")} className={LBL}>
              Type
            </span>
            <div
              role="radiogroup"
              aria-labelledby={id("type")}
              className="flex gap-0.5 rounded-[11px] bg-[#F1F2F7] p-[3px]"
            >
              {CLASS_TYPES.map(([value, label]) => {
                const on = card.details.classType === value;
                return (
                  <label
                    key={value}
                    className={cn(
                      "flex h-8 cursor-pointer items-center whitespace-nowrap rounded-[9px] px-3.5 text-[13px] font-bold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400 pointer-coarse:h-10",
                      on ? "bg-white text-ink shadow-[0_1px_2px_rgba(23,21,43,0.12)]" : "text-[#5E5A73] hover:text-ink",
                    )}
                  >
                    <input
                      type="radio"
                      name={id("type")}
                      value={value}
                      checked={on}
                      onChange={() => onType(value)}
                      className="sr-only"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id("capacity")} className={LBL}>
              Capacity
            </label>
            <input
              id={id("capacity")}
              type="number"
              inputMode="numeric"
              min={1}
              max={200}
              value={oneOnOne ? 1 : Number.isNaN(card.details.capacity) ? "" : card.details.capacity}
              onChange={(e) => onDetails({ capacity: e.target.valueAsNumber })}
              disabled={oneOnOne}
              title={oneOnOne ? "A one-on-one class has one place" : undefined}
              className="h-[38px] w-20 rounded-[11px] border border-[#DCDEE9] bg-white px-2.5 text-[14px] tabular-nums text-ink transition-colors focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10 disabled:bg-[#F1F2F7] disabled:text-ink-soft pointer-coarse:h-11"
            />
          </div>
        </div>

        <ClassStudents
          students={card.students}
          capacity={card.details.capacity || 1}
          oneOnOne={oneOnOne}
          candidates={candidates}
          onChange={onStudents}
        />

        {error && (
          <p role="alert" className="text-[13px] font-semibold text-bad">
            {error}
          </p>
        )}
        {notice && (
          <p aria-live="polite" className="flex items-center gap-2 text-[13px] font-semibold text-[#1E4FB8]">
            <Bell className="h-[15px] w-[15px] shrink-0" strokeWidth={1.9} aria-hidden />
            {notice}
          </p>
        )}
      </div>
    </div>
  );
}
