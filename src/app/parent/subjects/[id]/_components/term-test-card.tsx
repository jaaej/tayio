import Link from "next/link";
import { Award, ArrowRight } from "lucide-react";

/**
 * Entry point to a child's released term-test results, shown on the
 * parent's subject page. Unlike the student subject page's TermTestCard
 * (which has to render three states - take / submitted-pending / released
 * - because the student can act on the test), the parent never takes the
 * test and must not see anything before release, so there is only one
 * state worth linking to here: released. The caller only renders this
 * component once it already knows results are released.
 */
export function ParentTermTestCard({
  termTestId,
  childId,
}: {
  termTestId: string;
  childId: string;
}) {
  return (
    <Link
      href={`/parent/term-tests/${termTestId}/${childId}`}
      className="group relative flex min-h-20 items-center gap-4 overflow-hidden rounded-[14px] border border-line bg-surface px-5 py-4 shadow-[0_1px_2px_rgba(15,17,30,0.05)] transition-all duration-150 hover:-translate-y-[3px] motion-reduce:transition-none motion-reduce:hover:translate-y-0 hover:shadow-[0_24px_50px_-22px_rgba(31,40,90,0.30)]"
    >
      <span
        aria-hidden
        className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-brand-100 text-brand-700"
      >
        <Award className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-700">
          Term test results
        </span>
        <span className="mt-0.5 block text-[13px] font-semibold text-muted">
          Score, rank, and corrections are ready
        </span>
      </span>
      <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand-500 px-4 text-[12px] font-bold text-white transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
        View <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
