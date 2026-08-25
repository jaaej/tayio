import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/admin/ui";

/**
 * Read-only summary for the record rail. The caller supplies the rows, so
 * this stays a layout component with no opinion about what it is summarising.
 */
export function AtAGlance({
  rows,
}: {
  rows: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <Card>
      <CardBody>
        <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-2">
          At a glance
        </div>
        <dl className="mt-3 space-y-2.5">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-4"
            >
              <dt className="text-[13px] text-ink-soft">{row.label}</dt>
              <dd className="min-w-0 truncate text-right text-[13px] font-bold text-ink">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}
