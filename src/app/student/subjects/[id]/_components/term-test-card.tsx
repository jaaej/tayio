import Link from "next/link";
import { ArrowRight, Award, CheckCircle2, Hourglass } from "lucide-react";
import { deriveTermTestState } from "@/lib/term-test";
import type { AccentTokens } from "@/lib/subject-colors";

/**
 * Subject-level card for the term test tied to the currently viewed term.
 * Deliberately separate from WeekContent's per-week practice-quiz card -
 * a term test spans the whole term, not one week, so it lives one level up
 * in the page rather than inside the week view.
 */
export function TermTestCard({
  termTest,
  accent,
}: {
  termTest: { id: string; resultsReleaseAt: Date; hasAttempt: boolean };
  accent: AccentTokens;
}) {
  const state = deriveTermTestState({
    status: "approved",
    resultsReleaseAt: termTest.resultsReleaseAt,
    now: new Date(),
    hasAttempt: termTest.hasAttempt,
  });

  const { label, sub, Icon } =
    state === "released"
      ? { label: "Results", sub: "Score, rank, and corrections are ready", Icon: Award }
      : state === "submitted_pending"
        ? { label: "Submitted", sub: "Results release after the date your tutor set", Icon: Hourglass }
        : { label: "Take", sub: "One attempt - counts toward the leaderboard", Icon: CheckCircle2 };

  return (
    <Link
      href={`/student/term-tests/${termTest.id}`}
      className="group relative flex min-h-20 items-center gap-4 overflow-hidden rounded-[18px] border border-line bg-surface px-5 py-4 shadow-[0_1px_2px_rgba(15,17,30,0.04),0_8px_24px_-18px_rgba(31,40,90,0.24)] transition-all duration-200 motion-reduce:transition-none hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_rgba(31,40,90,0.32)] motion-reduce:hover:translate-y-0"
    >
      <span
        aria-hidden
        className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px]"
        style={{ background: accent.bgFrom, color: accent.arrow }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block text-[10px] font-extrabold uppercase tracking-[0.16em]"
          style={{ color: accent.meta }}
        >
          Term test
        </span>
        <span className="mt-0.5 block text-[13px] font-semibold text-muted">{sub}</span>
      </span>
      <span
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[12px] font-bold text-white transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        style={{ background: accent.arrow }}
      >
        {label} <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
