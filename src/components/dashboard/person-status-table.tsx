import Link from "next/link";
import type { ReactNode } from "react";
import { Empty } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export type PersonStatusRow = {
  id: string;
  firstName: string;
  lastName: string;
  /** Class context; null renders a dash. */
  context: string | null;
  reason: string;
  tone: "bad" | "warn";
  /** Where the name links on phones (the whole row is the target there). */
  href: string;
  /** Right-hand action cell: a link or a button. */
  action: ReactNode;
};

const TONE = {
  bad: "bg-bad-bg text-bad",
  warn: "bg-warn-bg text-warn",
} as const;

function ReasonPill({ row }: { row: PersonStatusRow }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold",
        TONE[row.tone],
      )}
    >
      {row.reason}
    </span>
  );
}

/**
 * People who need a nudge, with why and one action: admin "Students to
 * watch" and tutor "Students to bump". Goes inside a GlassPanel.
 */
export function PersonStatusTable({
  rows,
  empty,
  contextLabel = "Class",
  phoneAction = true,
}: {
  rows: PersonStatusRow[];
  empty: string;
  contextLabel?: string;
  /** False when the action only repeats the row link (e.g. "View student"). */
  phoneAction?: boolean;
}) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <>
      {/* Phones: one stacked row per person so the reason stays visible. */}
      <ul className="divide-y divide-line sm:hidden">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3 px-4 py-3">
            <Link
              href={row.href}
              className="min-w-0 flex-1 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <div className="text-[13px] font-bold text-ink">
                {row.firstName} {row.lastName}
              </div>
              {row.context && (
                <div className="text-[12px] text-ink-soft">{row.context}</div>
              )}
              <span className="mt-1.5 inline-flex">
                <ReasonPill row={row} />
              </span>
            </Link>
            {phoneAction && <div className="shrink-0">{row.action}</div>}
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-line text-[11px] font-bold text-muted">
              <th scope="col" className="px-4 py-2.5">Student</th>
              <th scope="col" className="px-4 py-2.5">{contextLabel}</th>
              <th scope="col" className="px-4 py-2.5">Why</th>
              <th scope="col" className="px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-[#F8F9FC]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-extrabold text-ink"
                    >
                      {row.firstName.charAt(0)}
                      {row.lastName.charAt(0)}
                    </span>
                    <span className="text-[13px] font-bold text-ink">
                      {row.firstName} {row.lastName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[13px] text-ink-soft">
                  {row.context ?? "-"}
                </td>
                <td className="px-4 py-3">
                  <ReasonPill row={row} />
                </td>
                <td className="px-4 py-3 text-right">{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
