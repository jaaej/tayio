import Link from "next/link";
import { ArrowLeft, Check, ListChecks, Trophy, X } from "lucide-react";
import { TermTestLeaderboard } from "@/components/term-test/leaderboard";
import type { TermTestResults } from "@/lib/term-test-results";

type ReleasedResults = Extract<TermTestResults, { released: true }>;

export function TermTestResultsView({
  results,
  subjectName,
  termYear,
  termNumber,
  hrefBack,
  childName,
}: {
  results: ReleasedResults;
  subjectName: string;
  termYear: number;
  termNumber: number;
  hrefBack: string;
  /**
   * Set when a parent is viewing their child's results. Switches the
   * first-person "your"/"you" copy to third-person, named after the child,
   * and labels the highlighted leaderboard row with the child's name
   * instead of "you" (the board's "me" row is ranked around the child, not
   * the parent).
   */
  childName?: string;
}) {
  const pct = results.total > 0 ? Math.round((results.score / results.total) * 100) : 0;
  const myRow = results.board.top.find((r) => r.isMe) ?? results.board.me;
  const answerLabel = childName ? `${childName}'s answer` : "Your answer";

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-5">
      <Link
        href={hrefBack}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[13px] font-bold text-brand-700 transition-colors hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {subjectName}
      </Link>

      <section className="relative overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#4F5BD5_0%,#3F4AB5_54%,#2B3287_100%)] px-5 py-6 text-white shadow-[0_18px_42px_-24px_rgba(31,40,90,0.72)] sm:px-7">
        <div
          aria-hidden
          className="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[38px] border-white/10"
        />
        <div className="relative grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/75">
              {`${childName ? `${childName} - ` : ""}${subjectName} - ${termYear} Term ${termNumber} - Results`}
            </div>
            <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-[-0.025em] sm:text-[34px]">
              {results.title}
            </h1>
          </div>
          <div className="rounded-[18px] border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-[12px] font-bold text-white/80">
              <ListChecks className="h-4 w-4" />
              Score
            </div>
            <div className="mt-2 text-[28px] font-extrabold tabular-nums">
              {results.score}/{results.total}
            </div>
            <div className="text-[11px] font-semibold text-white/70">{pct}% correct</div>
          </div>
          {myRow && (
            <div className="rounded-[18px] border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-[12px] font-bold text-white/80">
                <Trophy className="h-4 w-4" />
                Rank
              </div>
              <div className="mt-2 text-[28px] font-extrabold tabular-nums">
                #{myRow.rank}
              </div>
              <div className="text-[11px] font-semibold text-white/70">on the leaderboard</div>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section className="space-y-3">
          <h2 className="px-1 text-[18px] font-extrabold tracking-[-0.01em] text-ink">
            Corrections
          </h2>
          <div className="space-y-3">
            {results.corrections.map((correction, index) => {
              const isCorrect = correction.isCorrect;
              return (
                <div
                  key={correction.questionId}
                  className="relative overflow-hidden rounded-[18px] border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(15,17,30,0.04)]"
                >
                  <div
                    aria-hidden
                    className={
                      "absolute inset-y-0 left-0 w-1.5 " +
                      (isCorrect ? "bg-good" : "bg-bad")
                    }
                  />
                  <div className="flex items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-brand-100 text-[12px] font-extrabold text-brand-ink">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[14px] font-bold leading-snug text-ink">
                          {correction.prompt}
                        </p>
                        <span
                          className={
                            "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold " +
                            (isCorrect ? "bg-good-bg text-good" : "bg-bad-bg text-bad")
                          }
                        >
                          {isCorrect ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                          {isCorrect ? "Correct" : "Incorrect"}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1 text-[13px] font-semibold">
                        <div className={isCorrect ? "text-good" : "text-bad"}>
                          {answerLabel}: {correction.selectedOptionText ?? "No answer"}
                        </div>
                        {!isCorrect && (
                          <div className="text-good">
                            Correct answer: {correction.correctOptionText}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <TermTestLeaderboard
          title={`${subjectName} - Term ${termNumber} leaderboard`}
          board={results.board}
          meLabel={childName ?? "you"}
        />
      </div>
    </div>
  );
}
