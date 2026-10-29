import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * The rest of a long list, opened in place behind "Show all {total} {noun}"
 * (a native disclosure, so it needs no script and adds no page). The button
 * goes away once the list is open.
 */
export function ShowAll({ total, noun, children }: { total: number; noun: string; children: ReactNode }) {
  return (
    <details className="group/more border-t border-line">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-1.5 px-4 text-[13px] font-bold text-brand-600 transition-colors hover:bg-surface-2 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 group-open/more:hidden [&::-webkit-details-marker]:hidden">
        Show all {total} {noun}
        <ChevronDown className="h-4 w-4" strokeWidth={2.4} aria-hidden />
      </summary>
      {children}
    </details>
  );
}
