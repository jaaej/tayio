import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ParentChild } from "../_data";

export function ChildSwitcher({
  children,
  selectedId,
  basePath,
}: {
  children: ParentChild[];
  selectedId: string | null;
  basePath: string;
}) {
  if (children.length <= 1) return null;
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-[16px] border border-line bg-card p-1.5 shadow-[0_1px_2px_rgba(15,17,30,0.04)]">
      {children.map((c) => {
        const active = c.id === selectedId;
        const href = `${basePath}?child=${c.id}`;
        return (
          <Link
            key={c.id}
            href={href}
            aria-current={active ? "true" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-[11px] px-3 py-2 transition-colors",
              active ? "bg-brand-50" : "hover:bg-surface-2",
            )}
          >
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-extrabold",
                active
                  ? "bg-brand-600 text-white"
                  : "bg-surface-2 text-ink-soft",
              )}
            >
              {c.firstName.charAt(0).toUpperCase()}
            </span>
            <span className="text-left leading-tight">
              <span
                className={cn(
                  "block text-[13px] font-bold",
                  active ? "text-brand-700" : "text-ink",
                )}
              >
                {c.firstName}
              </span>
              {c.yearLevel ? (
                <span className="block text-[11px] text-muted">
                  {c.yearLevel}
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function EmptyChildrenNotice() {
  return (
    <div className="rounded-[14px] border border-line bg-card p-10 text-center shadow-[0_1px_2px_rgba(15,17,30,0.04),0_8px_24px_-16px_rgba(31,40,90,0.10)]">
      <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-muted">
        No children linked
      </div>
      <p className="mt-4 text-ink-soft max-w-md mx-auto">
        Your account isn't linked to a student yet. Ask the admin team to add a
        family link so you can see your child's lessons, homework and feedback.
      </p>
    </div>
  );
}
