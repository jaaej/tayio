import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One titled section inside a profile's white tab panel (the admin user
 * profile and the tutor's student profile). Sections stack
 * flat with hairline dividers (set by the caller), so there is never a card
 * inside the panel. `flush` lets row lists run edge to edge.
 */
export function ProfileSection({
  title,
  note,
  action,
  flush = false,
  id,
  children,
}: {
  title: ReactNode;
  /** Short muted context beside the title, e.g. "admins only". */
  note?: ReactNode;
  action?: ReactNode;
  flush?: boolean;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-6 py-5", !flush && "px-4 sm:px-5")}>
      <div
        className={cn(
          "mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2",
          flush && "px-4 sm:px-5",
        )}
      >
        <h3 className="text-[14px] font-extrabold text-ink">
          {title}
          {note && (
            <span className="font-semibold text-muted"> · {note}</span>
          )}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}
