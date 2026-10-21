"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setQuizMajor } from "@/app/_actions/quizzes";

/** On a quiz's page: whether it counts towards term report ratings. */
export function MajorQuizToggle({ quizId, isMajor }: { quizId: string; isMajor: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(isMajor);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !on;
    setOn(next);
    setError(null);
    start(async () => {
      const res = await setQuizMajor({ quizId, isMajor: next }).catch(() => null);
      if (!res?.ok) {
        setOn(!next);
        setError(res?.error ?? "Could not change it. Try again.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="flex flex-col items-end gap-1">
      {/* The same switch as New class's "Repeats weekly". */}
      <label
        title="Counts towards term report ratings, with the topic tests"
        className="flex h-[38px] cursor-pointer items-center gap-2.5 rounded-[11px] px-3 text-[13px] font-bold text-ink"
      >
        Major quiz
        <span className="relative h-6 w-10 shrink-0">
          <input
            type="checkbox"
            role="switch"
            checked={on}
            disabled={pending}
            onChange={toggle}
            className="peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait"
          />
          <span
            aria-hidden
            className="block h-6 w-10 rounded-full bg-[#C9CBDA] transition-colors peer-checked:bg-ink peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400 peer-focus-visible:ring-offset-1"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(23,21,43,0.2)] transition-transform duration-150 peer-checked:translate-x-4"
          />
        </span>
      </label>
      {error && (
        <span role="alert" className="text-[12px] font-semibold text-bad">
          {error}
        </span>
      )}
    </span>
  );
}
