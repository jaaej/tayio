"use client";

import { useTransition } from "react";
import { Select } from "@/components/ui/select";
import {
  markInvoicePaid,
  setInvoiceStatus,
} from "@/app/admin/_lib/actions-invoices";

type Status =
  | "unpaid"
  | "paid"
  | "overdue"
  | "partially_paid"
  | "refunded"
  | "cancelled";

const STATUSES: Status[] = [
  "unpaid",
  "paid",
  "overdue",
  "partially_paid",
  "refunded",
  "cancelled",
];

export function InvoiceActions({ id, status }: { id: string; status: Status }) {
  const [pending, start] = useTransition();

  return (
    <div className="inline-flex items-center gap-2 justify-end">
      {status !== "paid" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm("Mark this invoice as paid?")) return;
            start(async () => {
              await markInvoicePaid(id);
            });
          }}
          className="text-[11px] font-bold uppercase tracking-[0.14em] text-good hover:brightness-90 disabled:opacity-50"
        >
          Mark paid
        </button>
      )}
      <Select
        defaultValue={status}
        disabled={pending}
        className="h-8 text-xs w-32"
        onChange={(e) => {
          const next = e.target.value as Status;
          if (next === status) return;
          if (
            ["refunded", "cancelled"].includes(next) &&
            !confirm(`Set status to "${next}"?`)
          ) {
            e.currentTarget.value = status;
            return;
          }
          start(async () => {
            await setInvoiceStatus(id, next);
          });
        }}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
      </Select>
    </div>
  );
}
