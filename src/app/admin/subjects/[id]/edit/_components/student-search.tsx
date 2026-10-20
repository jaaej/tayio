"use client";

import { useId, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type StudentOption = {
  id: string;
  name: string;
  /** "Glen Waverley SC · noah@taiyo.com", to tell students apart. */
  detail: string;
};

const MAX_SHOWN = 8;

/**
 * "Add a student": type to search every student account, then pick one with
 * the mouse or Enter. Picking adds the student at once; there is no Add
 * button. Keyboard: arrows move, Enter picks, Escape closes.
 */
export function StudentSearch({
  options,
  onPick,
}: {
  /** Students who can still be added. */
  options: StudentOption[];
  onPick: (id: string) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const found = q
      ? options.filter((o) => `${o.name} ${o.detail}`.toLowerCase().includes(q))
      : options;
    return found.slice(0, MAX_SHOWN);
  }, [options, query]);
  const shown = open && matches.length > 0;

  function pick(id: string) {
    onPick(id);
    setQuery("");
    setActive(0);
  }

  return (
    <div className="relative w-full sm:w-[240px]">
      <span className="flex h-[34px] items-center gap-1.5 rounded-[10px] border border-[#DCDEE9] bg-white px-2.5 text-[#5E5A73] focus-within:border-ink focus-within:ring-[3px] focus-within:ring-ink/10 pointer-coarse:h-11">
        <Plus className="h-[14px] w-[14px] shrink-0" strokeWidth={2.2} aria-hidden />
        <input
          role="combobox"
          aria-label="Add a student"
          aria-expanded={shown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={shown ? `${listId}-${active}` : undefined}
          value={query}
          placeholder="Add a student"
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, matches.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              // Never submit the page's form from here.
              e.preventDefault();
              if (shown && matches[active]) pick(matches[active].id);
            } else if (e.key === "Escape" && (shown || query)) {
              // Close the suggestions, not a panel the search sits in.
              e.preventDefault();
              setOpen(false);
              setQuery("");
            }
          }}
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-[#5E5A73]"
        />
      </span>
      {open && query.trim() && matches.length === 0 && (
        <p className="absolute right-0 z-20 mt-1 w-full rounded-[12px] border border-[#EFF0F5] bg-white px-3 py-2.5 text-[13px] text-[#5E5A73] shadow-[0_12px_32px_rgba(23,21,43,0.14)]">
          No student matches.
        </p>
      )}
      {shown && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Students"
          className="absolute right-0 z-20 mt-1 max-h-[280px] w-full min-w-[260px] overflow-y-auto rounded-[12px] border border-[#EFF0F5] bg-white p-1 shadow-[0_12px_32px_rgba(23,21,43,0.14)]"
        >
          {matches.map((o, i) => (
            <li
              key={o.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // Keep focus in the input so the list stays open until a pick.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o.id)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer flex-col rounded-[9px] px-2.5 py-2",
                i === active && "bg-[#F1F2F7]",
              )}
            >
              <span className="text-[13px] font-bold text-ink">{o.name}</span>
              <span className="truncate text-[12px] text-[#5E5A73]">{o.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
