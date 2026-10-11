"use client";

import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/admin/ui";
import {
  markInvoicePaid,
  setInvoiceStatus,
} from "@/app/admin/_lib/actions-invoices";
import { cn } from "@/lib/utils";
import {
  INVOICE_STATUSES,
  STATUS_LABEL,
  type InvoiceStatus,
} from "../_lib/families";

const STATUS_TONE: Record<InvoiceStatus, string> = {
  paid: "bg-good-bg text-good",
  unpaid: "bg-warn-bg text-warn",
  overdue: "bg-bad-bg text-bad",
  partially_paid: "bg-info-bg text-info",
  refunded: "bg-brand-100 text-brand-600",
  cancelled: "bg-surface-3 text-muted",
};

/**
 * The invoice's status pill is also its status control: a native select laid
 * over the pill, so the current state and the way to change it are one thing.
 */
export function InvoiceStatusSelect({
  id,
  status,
  label,
}: {
  id: string;
  status: InvoiceStatus;
  /** Accessible name, e.g. "Status for Term 4 · Sarah Student". */
  label: string;
}) {
  const [pending, start] = useTransition();

  return (
    <span
      className={cn(
        "relative inline-flex h-[30px] items-center gap-1 rounded-full pl-2.5 pr-2 text-[12px] font-bold transition focus-within:ring-2 focus-within:ring-brand-400",
        STATUS_TONE[status],
        pending && "opacity-60",
      )}
    >
      <span aria-hidden>{STATUS_LABEL[status]}</span>
      <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
      <select
        aria-label={label}
        value={status}
        disabled={pending}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait"
        onChange={(event) => {
          const next = event.target.value as InvoiceStatus;
          if (next === status) return;
          if (
            (next === "refunded" || next === "cancelled") &&
            !confirm(`Set status to "${STATUS_LABEL[next]}"?`)
          ) {
            event.currentTarget.value = status;
            return;
          }
          start(async () => {
            await setInvoiceStatus(id, next);
          });
        }}
      >
        {INVOICE_STATUSES.map((value) => (
          <option key={value} value={value}>
            {STATUS_LABEL[value]}
          </option>
        ))}
      </select>
    </span>
  );
}

export function MarkPaidButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm("Mark this invoice as paid?")) return;
        start(async () => {
          await markInvoicePaid(id);
        });
      }}
    >
      {pending ? "Updating…" : "Mark paid"}
    </Button>
  );
}
