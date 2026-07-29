"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/admin/ui";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createInvoice } from "@/app/admin/_lib/actions-invoices";

export function CreateInvoiceForm({
  parents,
  students,
}: {
  parents: { id: string; firstName: string; lastName: string; email: string }[];
  students: { id: string; firstName: string; lastName: string }[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  return (
    <form
      className="grid sm:grid-cols-2 gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setOk(false);
        const fd = new FormData(e.currentTarget);
        const form = e.currentTarget;
        start(async () => {
          try {
            const res = await createInvoice({
              parentId: String(fd.get("parentId") || ""),
              studentId: String(fd.get("studentId") || "") || null,
              amount: Number(fd.get("amount") || 0),
              currency: String(fd.get("currency") || "AUD"),
              dueDate: String(fd.get("dueDate") || ""),
              description: String(fd.get("description") || "") || undefined,
            });
            if (res.ok) {
              setOk(true);
              form.reset();
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
          }
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="parentId">Bill parent</Label>
        <Select id="parentId" name="parentId" required defaultValue="">
          <option value="" disabled>
            Pick a parent
          </option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName} · {p.email}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="studentId">For student (optional)</Label>
        <Select id="studentId" name="studentId" defaultValue="">
          <option value="">-</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.firstName} {s.lastName}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="amount">Amount</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="currency">Currency</Label>
        <Input id="currency" name="currency" defaultValue="AUD" maxLength={3} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dueDate">Due date</Label>
        <Input id="dueDate" name="dueDate" type="date" required />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          name="description"
          placeholder="Term 2 · 10 lessons"
        />
      </div>
      <div className="sm:col-span-2 flex items-center gap-3 pt-2">
        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? "Creating…" : "Create invoice"}
        </Button>
        {ok && <span className="text-[12px] font-semibold text-good">Invoice created.</span>}
        {error && <span className="text-[12px] font-semibold text-bad">{error}</span>}
      </div>
    </form>
  );
}
