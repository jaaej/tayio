import Link from "next/link";
import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

/**
 * Left pane of a list + detail split view (admin Users and Attendance, tutor
 * Students and Marking): a sticky glass frame with a header (title, filters)
 * over a scrolling white list. Below xl only one pane shows at a time, so
 * pass `hiddenBelowXl` while a detail item is open.
 */
export function ListPane({
  labelledBy,
  header,
  children,
  hiddenBelowXl = false,
  scrollRef,
  className,
}: {
  labelledBy: string;
  header: ReactNode;
  children: ReactNode;
  hiddenBelowXl?: boolean;
  scrollRef?: Ref<HTMLDivElement>;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cn(
        "glass min-w-0 flex-col rounded-[24px] p-1.5",
        "xl:sticky xl:top-[var(--portal-sticky-top)] xl:flex xl:max-h-[calc(100dvh_-_2*var(--portal-sticky-top))] xl:w-[380px] xl:shrink-0 2xl:w-[420px]",
        hiddenBelowXl ? "hidden" : "flex",
        className,
      )}
    >
      <div className="flex flex-col gap-2.5 px-2 pb-2.5 pt-2 sm:pl-3">{header}</div>
      <div
        ref={scrollRef}
        className="panel relative flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-1.5"
      >
        {children}
      </div>
    </section>
  );
}

/** Pane title: 20px extrabold, with an optional count. */
export function ListPaneTitle({
  id,
  as: Heading = "h1",
  count,
  children,
}: {
  id: string;
  as?: "h1" | "h2";
  count?: number;
  children: ReactNode;
}) {
  return (
    <Heading id={id} className="text-[20px] font-extrabold leading-tight text-ink">
      {children}
      {count !== undefined && (
        <>
          {" "}
          <span className="text-[14px] font-bold tabular-nums text-ink-soft">{count}</span>
        </>
      )}
    </Heading>
  );
}

/** Uppercase group label inside the list (a year level, a class). */
export function ListPaneGroup({
  id,
  label,
  children,
}: {
  id: string;
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-labelledby={id}>
      <h2
        id={id}
        className="px-2.5 pb-1 pt-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted"
      >
        {label}
      </h2>
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </div>
  );
}

/** One selectable row; the selected row is tinted and marked aria-current. */
export function ListPaneRow({
  href,
  selected,
  children,
  className,
}: {
  href: string;
  selected: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "flex min-h-[50px] items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-ink transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400",
        selected ? "bg-surface-3" : "hover:bg-surface-2",
        className,
      )}
    >
      {children}
    </Link>
  );
}
