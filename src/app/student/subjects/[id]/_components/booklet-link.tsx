"use client";

import { useTransition } from "react";
import { markBookletOpened } from "../_actions";

export function BookletLink({
  subjectWeekId,
  alreadyOpened,
}: {
  subjectWeekId: string;
  alreadyOpened: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const res = await markBookletOpened(subjectWeekId);
          if (res.ok) window.open(res.url, "_blank", "noopener");
          else alert(res.error);
        });
      }}
      className="inline-flex items-center gap-2 rounded-lg border border-hairline/60 bg-card px-4 py-2 text-sm font-medium hover:bg-brand-50"
    >
      {pending
        ? "Opening…"
        : alreadyOpened
          ? "Open PDF (opened earlier)"
          : "Open PDF →"}
    </button>
  );
}
