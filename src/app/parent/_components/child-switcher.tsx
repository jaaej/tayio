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
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] uppercase tracking-[0.16em] text-muted mr-2">
        Viewing
      </span>
      {children.map((c) => {
        const active = c.id === selectedId;
        const href = `${basePath}?child=${c.id}`;
        return (
          <Link
            key={c.id}
            href={href}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm border transition-colors",
              active
                ? "border-navy-800 bg-navy-800 text-white"
                : "border-hairline text-ink-soft hover:text-ink hover:bg-brand-100",
            )}
          >
            {c.firstName}
            {c.yearLevel ? (
              <span className="ml-2 text-[11px] opacity-70">{c.yearLevel}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

export function EmptyChildrenNotice() {
  return (
    <div className="rounded-2xl border border-hairline/60 bg-card p-10 text-center">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
        No children linked
      </div>
      <p className="mt-4 text-ink-soft max-w-md mx-auto">
        Your account isn't linked to a student yet. Ask the admin team to add a
        family link so you can see your child's lessons, homework and feedback.
      </p>
    </div>
  );
}
