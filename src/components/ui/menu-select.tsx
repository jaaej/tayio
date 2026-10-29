"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type MenuSelectOption = { value: string; label: string };

/**
 * A select drawn in the portal's style: a "Label  Value" face that opens one
 * menu of options, instead of the browser's own picker. Keyboard follows the
 * listbox pattern: arrows (or Home / End) move, Enter or Space picks, Escape
 * closes and returns focus to the face, Tab closes and moves on.
 */
export function MenuSelect({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string;
  options: MenuSelectOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();
  const listId = `${id}-list`;
  const optionId = (i: number) => `${id}-option-${i}`;
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    function closeOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // optionId only depends on the stable useId value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  function openMenu() {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function pick(index: number) {
    close();
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
  }

  function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu();
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const last = options.length - 1;
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((i) => Math.min(last, i + 1)),
      ArrowUp: () => setActive((i) => Math.max(0, i - 1)),
      Home: () => setActive(0),
      End: () => setActive(last),
      Enter: () => pick(active),
      " ": () => pick(active),
      Escape: close,
    };
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    const run = keys[event.key];
    if (!run) return;
    event.preventDefault();
    run();
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onButtonKeyDown}
        className="flex h-[38px] w-full cursor-pointer items-center gap-2 rounded-[11px] bg-surface px-2.5 text-[13px] font-bold text-ink transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        {label}
        <span className="min-w-0 flex-1 truncate text-right font-extrabold">{current?.label}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            "h-4 w-4 shrink-0 text-muted transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={optionId(active)}
          onKeyDown={onListKeyDown}
          className="menu-pop absolute inset-x-0 top-[calc(100%+6px)] z-50 m-0 max-h-72 list-none overflow-y-auto rounded-[14px] border border-line bg-surface p-1.5 shadow-[0_16px_34px_-22px_rgba(31,40,90,0.45)]"
          // The highlighted option shows where the keyboard is, so the list
          // itself needs no ring. Inline, because the global *:focus-visible
          // outline is unlayered and outranks utility classes.
          style={{ outline: "none" }}
        >
          {options.map((option, i) => {
            const selected = option.value === value;
            return (
              <li
                key={option.value}
                id={optionId(i)}
                role="option"
                aria-selected={selected}
                onPointerMove={() => setActive(i)}
                onClick={() => pick(i)}
                className={cn(
                  "flex h-9 cursor-pointer items-center gap-2 rounded-[10px] px-2.5 text-[13px] text-ink",
                  i === active && "bg-surface-2",
                  selected ? "font-extrabold" : "font-semibold",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {selected && <Check aria-hidden className="h-4 w-4 shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
