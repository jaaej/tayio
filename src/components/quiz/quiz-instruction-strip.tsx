"use client";

import { useState } from "react";
import { ChevronUp, Info } from "lucide-react";

export function QuizInstructionStrip({ label, note }: { label: string; note: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4">
      <div className="pointer-events-auto w-full max-w-[760px] overflow-hidden rounded-[16px] border border-line bg-surface shadow-[0_20px_48px_-24px_rgba(31,40,90,0.5)]">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-[12px] font-extrabold uppercase tracking-[0.14em] text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Info className="h-4 w-4" />
          {label}
          <ChevronUp
            className={
              "ml-auto h-4 w-4 transition-transform duration-200 motion-reduce:transition-none " +
              (open ? "" : "rotate-180")
            }
          />
        </button>
        <div
          className={
            "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none " +
            (open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")
          }
        >
          <div className="overflow-hidden">
            <p className="whitespace-pre-wrap px-4 pb-4 text-[13px] leading-relaxed text-ink-soft">
              {note}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
