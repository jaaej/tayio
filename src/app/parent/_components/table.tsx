import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

/**
 * Reference data table (`.tbl`): uppercase header row on a tinted
 * surface, line row separators, hover highlight. Wrap in a Card with
 * `p-0 overflow-hidden` so the header bleeds to the card edges.
 */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({
  className = "",
  children,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em] font-bold text-muted bg-surface-2 border-b border-line whitespace-nowrap ${className}`}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({
  className = "",
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={`px-4 py-3 text-left align-middle border-b border-line/70 ${className}`}
      {...props}
    >
      {children}
    </td>
  );
}

/** Row with the reference hover highlight. */
export function Tr({ children }: { children: ReactNode }) {
  return <tr className="transition-colors hover:bg-surface-2/60">{children}</tr>;
}
