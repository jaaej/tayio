import Link from "next/link";
import type { ReactNode } from "react";
import { Empty, GlassPanel, buttonVariants } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export type TodoItem = {
  key: string;
  icon: ReactNode;
  /** Tinted tile classes, e.g. "bg-warn-bg text-warn". */
  tone: string;
  title: ReactNode;
  detail?: ReactNode;
  href: string;
  action: string;
};

const LINE_BUTTON = buttonVariants({ variant: "outline", size: "md" });

/**
 * "To do" on a portal home: one row per thing waiting on the signed-in
 * person, most urgent first, each with a single action. Shared by the admin
 * dashboard and tutor Today.
 */
export function TodoPanel({
  items,
  empty,
  count = items.length,
  className,
}: {
  items: TodoItem[];
  empty: string;
  /** Things waiting, when a row stands for several (the student's
   *  "17 overdue" summary row); defaults to one per row. */
  count?: number;
  className?: string;
}) {
  return (
    <GlassPanel
      className={className}
      title={
        <span className="inline-flex items-center gap-2">
          To do
          {count > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1.5 text-[11px] font-extrabold tabular-nums text-white">
              {count}
            </span>
          )}
        </span>
      }
    >
      {items.length === 0 ? (
        <Empty>{empty}</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex items-center gap-3.5 px-4 py-[13px] transition-colors hover:bg-[#F8F9FC]"
            >
              <span
                aria-hidden
                className={cn(
                  "grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px]",
                  item.tone,
                )}
              >
                {item.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold text-ink">{item.title}</div>
                {item.detail && (
                  <div className="text-[13px] text-muted">{item.detail}</div>
                )}
              </div>
              <Link href={item.href} className={cn(LINE_BUTTON, "shrink-0")}>
                {item.action}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}
