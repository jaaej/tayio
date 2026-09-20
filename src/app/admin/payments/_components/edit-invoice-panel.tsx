"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Button, SidePanel } from "@/components/admin/ui";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { updateInvoice } from "@/app/admin/_lib/actions-invoices";

type Status =
  | "unpaid"
  | "paid"
  | "overdue"
  | "partially_paid"
  | "refunded"
  | "cancelled";

const STATUSES: { value: Status; label: string }[] = [
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "refunded", label: "Refunded" },
  { value: "cancelled", label: "Cancelled" },
];

export type EditableInvoice = {
  id: string;
  parentId: string;
  studentId: string | null;
  amount: string;
  currency: string;
  dueDate: string;
  description: string | null;
  status: Status;
  paidAt: Date | null;
};

export function EditInvoicePanel({
  invoice,
  parents,
  students,
}: {
  invoice: EditableInvoice;
  parents: { id: string; name: string; email: string }[];
  students: { id: string; name: string; parentIds: string[] }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(invoice.status);
  const [parentId, setParentId] = useState(invoice.parentId);
  const formId = useId();
  const eligibleStudents = students.filter((student) =>
    student.parentIds.includes(parentId),
  );
  const needsPaidDate = status === "paid" || status === "refunded";

  function close() {
    if (pending) return;
    setError(null);
    setStatus(invoice.status);
    setParentId(invoice.parentId);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-soft transition hover:border-brand-400 hover:text-brand-700"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        Edit
      </button>
      <SidePanel
        open={open}
        onClose={close}
        title="Edit invoice"
        sub="Admin-only manual correction. Every saved change is actor-attributed in the audit log."
        size="wide"
        footer={
          <>
            <Button type="button" size="lg" variant="ghost" disabled={pending} onClick={close}>
              Cancel
            </Button>
            <Button type="submit" form={formId} size="lg" disabled={pending}>
              {pending ? "Saving…" : "Save invoice"}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            const data = new FormData(event.currentTarget);
            start(async () => {
              try {
                const result = await updateInvoice({
                  id: invoice.id,
                  parentId: String(data.get("parentId") ?? ""),
                  studentId: String(data.get("studentId") ?? "") || null,
                  amount: Number(data.get("amount") ?? 0),
                  currency: String(data.get("currency") ?? "AUD"),
                  dueDate: String(data.get("dueDate") ?? ""),
                  description: String(data.get("description") ?? "") || undefined,
                  status,
                  paidDate: String(data.get("paidDate") ?? "") || null,
                });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setOpen(false);
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Invoice update failed.");
              }
            });
          }}
        >
          <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
            <Field label="Bill parent" htmlFor={`${formId}-parent`}>
              <Select
                id={`${formId}-parent`}
                name="parentId"
                required
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
              >
                {parents.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {parent.name} · {parent.email}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="For student" htmlFor={`${formId}-student`}>
              <Select
                key={parentId}
                id={`${formId}-student`}
                name="studentId"
                defaultValue={
                  eligibleStudents.some((student) => student.id === invoice.studentId)
                    ? (invoice.studentId ?? "")
                    : ""
                }
              >
                <option value="">No linked student</option>
                {eligibleStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Amount" htmlFor={`${formId}-amount`}>
              <Input
                id={`${formId}-amount`}
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={invoice.amount}
                required
              />
            </Field>
            <Field label="Currency" htmlFor={`${formId}-currency`}>
              <Input
                id={`${formId}-currency`}
                name="currency"
                minLength={3}
                maxLength={3}
                defaultValue={invoice.currency}
                required
              />
            </Field>
            <Field label="Due date" htmlFor={`${formId}-due-date`}>
              <Input
                id={`${formId}-due-date`}
                name="dueDate"
                type="date"
                defaultValue={invoice.dueDate}
                required
              />
            </Field>
            <Field label="Status" htmlFor={`${formId}-status`}>
              <Select
                id={`${formId}-status`}
                name="status"
                value={status}
                onChange={(event) => setStatus(event.target.value as Status)}
              >
                {STATUSES.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </Select>
            </Field>
            {needsPaidDate ? (
              <Field label="Original payment date" htmlFor={`${formId}-paid-date`}>
                <Input
                  id={`${formId}-paid-date`}
                  name="paidDate"
                  type="date"
                  defaultValue={invoice.paidAt ? isoDate(invoice.paidAt) : isoDate(new Date())}
                  required
                />
              </Field>
            ) : null}
            <div className="sm:col-span-2">
              <Field label="Description" htmlFor={`${formId}-description`}>
                <Input
                  id={`${formId}-description`}
                  name="description"
                  maxLength={1000}
                  defaultValue={invoice.description ?? ""}
                  placeholder="Term and lesson details"
                />
              </Field>
            </div>
          </fieldset>
          {error ? (
            <p role="alert" className="rounded-[10px] bg-bad-bg px-3 py-2 text-[12px] font-semibold text-bad">
              {error}
            </p>
          ) : null}
        </form>
      </SidePanel>
    </>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="block font-bold">
        {label}
      </Label>
      {children}
    </div>
  );
}

function isoDate(date: Date) {
  const part = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}`;
}
