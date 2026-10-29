import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Empty, Pill } from "@/components/admin/ui";
import { formatDateShort, formatScore, formatWeekday } from "@/lib/format";
import type { HomeworkHistoryRow } from "@/lib/student-history";
import { cn } from "@/lib/utils";
import { ShowAll } from "./show-all";

const ROW =
  "flex min-h-12 items-center gap-3 px-4 py-2.5 text-ink transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 sm:px-5";

/**
 * A student's homework, latest due first, as edge-to-edge rows split by
 * hairlines. Shared by the tutor's profile, where a row opens Marking
 * (`rowHref`), and the admin's History tab, where it opens in place to show
 * the hand-in and feedback (`renderDetail`). With `limit`, older homework
 * opens in place behind "Show all".
 */
export function HomeworkList<R extends HomeworkHistoryRow>({
  rows,
  rowHref,
  renderDetail,
  limit,
  className,
}: {
  rows: R[];
  rowHref?: (row: R) => string;
  renderDetail?: (row: R) => ReactNode;
  limit?: number;
  className?: string;
}) {
  if (rows.length === 0) return <Empty>No homework assigned yet.</Empty>;
  const shown = limit ? rows.slice(0, limit) : rows;
  const rest = limit ? rows.slice(limit) : [];
  const item = (row: R) => (
    <li key={row.homeworkId}>
      {rowHref ? (
        <Link href={rowHref(row)} className={ROW}>
          <RowBody row={row} />
        </Link>
      ) : renderDetail ? (
        <details className="group/row">
          <summary className={cn(ROW, "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
            <RowBody row={row} />
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted transition-transform duration-150 group-open/row:rotate-180"
              strokeWidth={2.4}
              aria-hidden
            />
          </summary>
          {/* The detail sections pad 16px; 4px more lines them up with the rows' 20px. */}
          <div className="border-t border-line bg-surface-2/60 sm:px-1">{renderDetail(row)}</div>
        </details>
      ) : (
        <div className={ROW}>
          <RowBody row={row} />
        </div>
      )}
    </li>
  );
  return (
    <div className={className}>
      <ul className="divide-y divide-line">{shown.map(item)}</ul>
      {rest.length > 0 && (
        <ShowAll total={rows.length} noun="homework">
          <ul className="divide-y divide-line">{rest.map(item)}</ul>
        </ShowAll>
      )}
    </div>
  );
}

function RowBody({ row }: { row: HomeworkHistoryRow }) {
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-bold">{row.title}</span>
        <span className="truncate text-[12px] text-muted">
          Due {formatWeekday(row.dueDate, "short")} {formatDateShort(row.dueDate)}
          {row.className && ` · ${row.className}`}
        </span>
      </span>
      {row.state === "marked" && row.score !== null && (
        <span className="shrink-0 text-[13px] font-extrabold tabular-nums">
          {formatScore(row.score)}
          <span className="sr-only"> score</span>
        </span>
      )}
      <Pill tone={row.tone} className="shrink-0">
        {row.label}
      </Pill>
    </>
  );
}
