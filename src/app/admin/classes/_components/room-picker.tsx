"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { roomTaken, type RoomSlot, type RoomUse } from "../_lib/rooms";
import { cn } from "@/lib/utils";

const OTHER = "__other";

/**
 * A class's room, in New class and on the subject page's class cards: a list
 * of the rooms in use, then "Online" and "Other…", which turns the field into
 * a text box. A room another weekly class uses at an overlapping time reads
 * "· taken" and cannot be picked (unless it is already this class's room).
 * The look of the field comes from the surrounding form.
 */
export function RoomPicker({
  id,
  name,
  value,
  onChange,
  rooms,
  slot,
  others,
  fieldClassName,
}: {
  id: string;
  /** Set when the room is posted with a form. */
  name?: string;
  value: string;
  onChange: (room: string) => void;
  /** `roomChoices` of the rooms in use, "Online" last. */
  rooms: string[];
  /** The day and time the class would be on. */
  slot: RoomSlot;
  /** Every other weekly class's slot and room. */
  others: RoomUse[];
  /** Border, height, radius and text of the field, from the form. */
  fieldClassName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listed = rooms.find((r) => r.toLowerCase() === value.trim().toLowerCase());
  const [typing, setTyping] = useState(() => value.trim() !== "" && !listed);
  const typed = typing || (value.trim() !== "" && !listed);
  // "Other…" swaps the list for a text box; put the cursor in it. The room
  // picked before is kept, so × can put it back.
  const focusText = useRef(false);
  const before = useRef("");
  useEffect(() => {
    if (typed && focusText.current) {
      focusText.current = false;
      inputRef.current?.focus();
    }
  }, [typed]);

  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      {typed ? (
        <span className="relative block min-w-0">
          <input
            ref={inputRef}
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type a room"
            maxLength={200}
            autoComplete="off"
            className={cn(fieldClassName, "w-full pr-9")}
          />
          <button
            type="button"
            onClick={() => {
              setTyping(false);
              onChange(before.current);
              before.current = "";
            }}
            aria-label="Choose from the room list"
            title="Choose from the list"
            className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-[8px] text-muted transition-colors hover:bg-[#F1F2F7] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <X className="h-[14px] w-[14px]" strokeWidth={2.2} aria-hidden />
          </button>
        </span>
      ) : (
        <span className="relative block min-w-0">
          <select
            id={id}
            value={listed ?? ""}
            onChange={(e) => {
              if (e.target.value === OTHER) {
                before.current = value;
                focusText.current = true;
                setTyping(true);
                onChange("");
              } else {
                onChange(e.target.value);
              }
            }}
            className={cn(fieldClassName, "w-full cursor-pointer appearance-none pr-9")}
          >
            <option value="">No room</option>
            {rooms.map((room) => {
              const taken = room !== listed && roomTaken(room, slot, others);
              return (
                <option key={room} value={room} disabled={taken}>
                  {taken ? `${room} · taken` : room}
                </option>
              );
            })}
            <option value={OTHER}>Other…</option>
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          />
        </span>
      )}
    </>
  );
}
