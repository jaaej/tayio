"use client";

import { roomTaken, type RoomSlot, type RoomUse } from "../_lib/rooms";
import { cn } from "@/lib/utils";

/**
 * A class's room, in New class and on the subject page's class cards: type
 * one, or pick a chip for a room in use (then "Online"). A chip is crossed
 * out when another class uses that room at an overlapping time; it can still
 * be chosen. The label and the input's look come from the surrounding form.
 */
export function RoomPicker({
  id,
  name,
  value,
  onChange,
  rooms,
  slot,
  others,
  inputClassName,
}: {
  id: string;
  /** Set when the room is posted with a form. */
  name?: string;
  value: string;
  onChange: (room: string) => void;
  /** Chips: `roomChoices` of the rooms in use. */
  rooms: string[];
  /** The day and time the class would be on. */
  slot: RoomSlot;
  /** Every other weekly class's slot and room. */
  others: RoomUse[];
  inputClassName?: string;
}) {
  return (
    <>
      <input
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type a room"
        maxLength={200}
        autoComplete="off"
        className={inputClassName}
      />
      <div className="flex flex-wrap gap-1">
        {rooms.map((room) => {
          const selected = value.trim().toLowerCase() === room.toLowerCase();
          const taken = !selected && roomTaken(room, slot, others);
          return (
            <button
              key={room}
              type="button"
              onClick={() => onChange(room)}
              aria-pressed={selected}
              aria-label={taken ? `${room}, taken at this time` : room}
              title={taken ? "Taken at this time" : selected ? "Selected" : "Free at this time"}
              className={cn(
                "h-[26px] rounded-[13px] border px-[9px] text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                selected
                  ? "border-ink bg-ink text-white"
                  : taken
                    ? "border-[#DCDEE9] bg-white text-[#9A9AAD] line-through"
                    : "border-[#DCDEE9] bg-white text-ink hover:bg-[#F6F7FA]",
              )}
            >
              {room}
            </button>
          );
        })}
      </div>
    </>
  );
}
