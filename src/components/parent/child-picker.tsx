"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { pickSelectedChild, rememberSelectedChild } from "@/lib/parent-child";
import { cn } from "@/lib/utils";

export type PickerChild = { id: string; firstName: string; yearLevel: string | null };

/** Pages about the whole family, where switching child only remembers it. */
const FAMILY_PAGES = ["/parent/messages", "/parent/notifications", "/parent/payments"];

/**
 * Where to go after picking another child: the same section's main page
 * (a homework or a recap belongs to one child), or nowhere on family pages.
 */
function targetFor(pathname: string, childId: string): string | null {
  if (FAMILY_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  const section = pathname.split("/").slice(0, 3).join("/") || "/parent";
  return `${section}?child=${childId}`;
}

/**
 * The child switcher in the parent's side menu (and, as initials, in the
 * phone header): one place for every page. The child on screen is `?child=`,
 * else the one chosen last (the cookie the server reads too), else the
 * first; arriving on a child from a link remembers that child.
 */
export function ChildPicker({
  kids,
  rememberedId,
  compact = false,
}: {
  kids: PickerChild[];
  rememberedId: string | null;
  /** Initials only, for the phone header. */
  compact?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const requested = useSearchParams().get("child");
  const [currentId, setCurrentId] = useState(
    () => pickSelectedChild(kids, requested, rememberedId)?.id ?? null,
  );

  useEffect(() => {
    if (requested && kids.some((k) => k.id === requested)) {
      setCurrentId(requested);
      rememberSelectedChild(requested);
    }
  }, [requested, kids]);

  function choose(id: string) {
    if (id === currentId) return;
    rememberSelectedChild(id);
    setCurrentId(id);
    const target = targetFor(pathname, id);
    if (target) router.push(target);
    else router.refresh();
  }

  if (compact) {
    return (
      <div role="group" aria-label="Child" className="flex items-center gap-1">
        {kids.map((k) => {
          const on = k.id === currentId;
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => choose(k.id)}
              aria-pressed={on}
              aria-label={`Show ${k.firstName}`}
              title={k.firstName}
              className={cn(
                "grid h-9 w-9 place-items-center rounded-full text-[12px] font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                on ? "bg-ink text-white" : "bg-white/80 text-ink hover:bg-white",
              )}
            >
              {k.firstName.charAt(0).toUpperCase()}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="group" aria-label="Child" className="portal-feature flex flex-col gap-0.5 rounded-[14px] bg-white/55 p-1">
      {kids.map((k) => {
        const on = k.id === currentId;
        return (
          <button
            key={k.id}
            type="button"
            onClick={() => choose(k.id)}
            aria-pressed={on}
            title={k.firstName}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
              on ? "bg-ink text-white" : "text-ink hover:bg-white/80",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-extrabold",
                on ? "bg-white text-ink" : "bg-surface-3 text-ink",
              )}
            >
              {k.firstName.charAt(0).toUpperCase()}
            </span>
            <span className="portal-feature-text flex min-w-0 flex-1 flex-col leading-[1.15]">
              <span className="truncate text-[13px] font-bold">{k.firstName}</span>
              {k.yearLevel && (
                <span className={cn("text-[11px]", on ? "text-white/75" : "text-muted")}>
                  {k.yearLevel}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
