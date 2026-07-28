"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { markBookletOpened } from "../_actions";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export function BookletLink({
  subjectWeekId,
  alreadyOpened,
}: {
  subjectWeekId: string;
  alreadyOpened: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const res = await markBookletOpened(subjectWeekId);
          if (res.ok) {
            window.open(res.url, "_blank", "noopener");
            router.refresh();
          } else {
            alert(res.error);
          }
        });
      }}
      className={cn(
        "group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-line bg-surface-2 px-4 text-[13px] font-bold text-ink transition-colors motion-reduce:transition-none hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-60",
        FOCUS_RING,
      )}
    >
      <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
      {pending
        ? "Opening…"
        : alreadyOpened
          ? "Open PDF (opened earlier)"
          : "Open PDF"}
      <ArrowRight
        aria-hidden
        className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
      />
    </button>
  );
}
